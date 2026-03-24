"""GitLab PAT collector — extracts tokens from glab CLI config, env vars,
macOS Keychain, and ~/.netrc.

Sources checked (in order):
1. glab config file: ~/.config/glab-cli/config.yml (token: field per host)
2. Environment variables: GITLAB_TOKEN, GITLAB_PRIVATE_TOKEN
3. macOS Keychain: glab:<host> entries (go-keyring format, same as gh CLI)
4. ~/.netrc: machine gitlab.com entries with glpat-* passwords
"""

from __future__ import annotations

import base64
import os
import re
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import home_dir, get_platform


@CollectorRegistry.register
class GitLabPatCollector(BaseCollector):
    service = "gitlab"
    source = "pat"
    stealth_score = 5

    # ------------------------------------------------------------------ #
    # Path helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _config_path() -> Path:
        """Return the glab CLI config file path."""
        # glab stores config in ~/.config/glab-cli/config.yml on all platforms
        # Respects GLAB_CONFIG_DIR if set
        config_dir = os.environ.get("GLAB_CONFIG_DIR")
        if config_dir:
            return Path(config_dir) / "config.yml"
        plat = get_platform()
        if plat == "windows":
            appdata = os.environ.get("APPDATA", str(home_dir() / "AppData" / "Roaming"))
            return Path(appdata) / "glab-cli" / "config.yml"
        return home_dir() / ".config" / "glab-cli" / "config.yml"

    @staticmethod
    def _netrc_path() -> Path:
        """Return the .netrc path."""
        plat = get_platform()
        if plat == "windows":
            return home_dir() / "_netrc"
        return home_dir() / ".netrc"

    # ------------------------------------------------------------------ #
    # glab config YAML parsing (regex, no PyYAML)
    # ------------------------------------------------------------------ #

    def _parse_config_yml(self, text: str) -> List[Tuple[str, dict]]:
        """Parse glab config.yml using regex — no PyYAML dependency.

        Format:
        hosts:
            gitlab.com:
                token: glpat-xxxxxxxx
                api_host: gitlab.com
                git_protocol: https
                user: username
        """
        entries: List[Tuple[str, dict]] = []
        in_hosts = False
        current_host: Optional[str] = None
        current_data: dict = {}

        for line in text.splitlines():
            # Detect the top-level `hosts:` block
            if re.match(r'^hosts:\s*$', line):
                in_hosts = True
                continue

            # Another top-level key ends the hosts block
            if in_hosts and re.match(r'^[a-zA-Z]', line):
                if current_host and current_data:
                    entries.append((current_host, current_data))
                in_hosts = False
                current_host = None
                current_data = {}
                continue

            if not in_hosts:
                continue

            # Host key (one level of indent, e.g. "    gitlab.com:")
            host_match = re.match(r'^\s{2,4}(\S+):\s*$', line)
            if host_match:
                if current_host and current_data:
                    entries.append((current_host, current_data))
                current_host = host_match.group(1)
                current_data = {}
                continue

            # Indented key-value under a host (deeper indent)
            kv_match = re.match(r'^\s{4,8}(\w[\w_]*):\s*(.+)$', line)
            if kv_match and current_host:
                current_data[kv_match.group(1)] = kv_match.group(2).strip()

        # Flush last host
        if current_host and current_data:
            entries.append((current_host, current_data))

        return entries

    # ------------------------------------------------------------------ #
    # macOS Keychain
    # ------------------------------------------------------------------ #

    @staticmethod
    def _read_keychain(host: str) -> Optional[str]:
        """Read glab token from macOS Keychain (glab: prefixed entries).

        glab CLI uses go-keyring which may base64-wrap values with a
        ``go-keyring-base64:`` prefix — same pattern as gh CLI.
        """
        if get_platform() != "macos":
            return None
        try:
            result = subprocess.run(
                ["security", "find-generic-password", "-s", f"glab:{host}", "-w"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                raw = result.stdout.strip()
                if raw.startswith("go-keyring-base64:"):
                    encoded = raw[len("go-keyring-base64:"):]
                    return base64.b64decode(encoded).decode("utf-8")
                return raw
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return None

    # ------------------------------------------------------------------ #
    # Environment variables
    # ------------------------------------------------------------------ #

    @staticmethod
    def _read_env() -> Optional[Tuple[str, str]]:
        """Check GITLAB_TOKEN and GITLAB_PRIVATE_TOKEN env vars.

        Returns (var_name, token_value) or None.
        """
        for var in ("GITLAB_TOKEN", "GITLAB_PRIVATE_TOKEN"):
            value = os.environ.get(var)
            if value and value.strip():
                return (var, value.strip())
        return None

    # ------------------------------------------------------------------ #
    # .netrc parsing
    # ------------------------------------------------------------------ #

    def _parse_netrc(self, text: str) -> List[Tuple[str, str, str]]:
        """Parse .netrc for GitLab entries.

        Returns list of (machine, login, password) tuples.
        Handles both single-line and multi-line .netrc formats.

        Single-line: machine gitlab.com login user password glpat-xxxx
        Multi-line:
          machine gitlab.com
          login user
          password glpat-xxxx
        """
        results: List[Tuple[str, str, str]] = []

        # Normalize: collapse lines and tokenize
        # .netrc allows entries split across lines
        tokens = text.split()
        i = 0
        while i < len(tokens):
            if tokens[i] == "machine":
                machine = tokens[i + 1] if i + 1 < len(tokens) else ""
                login = ""
                password = ""
                i += 2
                # Read login/password pairs until next machine or end
                while i < len(tokens) and tokens[i] != "machine":
                    if tokens[i] == "login" and i + 1 < len(tokens):
                        login = tokens[i + 1]
                        i += 2
                    elif tokens[i] == "password" and i + 1 < len(tokens):
                        password = tokens[i + 1]
                        i += 2
                    elif tokens[i] == "account" and i + 1 < len(tokens):
                        i += 2  # skip account field
                    elif tokens[i] == "macdef":
                        # Skip macro definitions (run until blank line)
                        break
                    else:
                        i += 1

                # Only include GitLab-related machines
                if "gitlab" in machine.lower() and password:
                    results.append((machine, login, password))
            else:
                i += 1

        return results

    # ------------------------------------------------------------------ #
    # discover()
    # ------------------------------------------------------------------ #

    def discover(self) -> List[DiscoveredToken]:
        results: List[DiscoveredToken] = []

        # 1. glab config file
        config = self._config_path()
        if config.exists():
            try:
                text = config.read_text()
                entries = self._parse_config_yml(text)
                for host, data in entries:
                    token = data.get("token", "")
                    user = data.get("user", "unknown")
                    if token:
                        preview = f"{token[:8]}..." if len(token) > 8 else "present"
                        details = f"token={preview}"
                    else:
                        # Check Keychain as fallback
                        kc = self._read_keychain(host)
                        if kc:
                            details = f"token in keychain (extractable, {kc[:8]}...)"
                        else:
                            details = "token in system keyring (not extractable)"
                    results.append(DiscoveredToken(
                        service=self.service,
                        source=self.source,
                        path=str(config),
                        account_hint=f"{user}@{host}",
                        stealth_score=self.stealth_score,
                        details=details,
                    ))
            except Exception as e:
                self._warn(f"Failed to parse {config}: {e}")

        # 2. Environment variables
        env_result = self._read_env()
        if env_result:
            var_name, token = env_result
            preview = f"{token[:8]}..." if len(token) > 8 else "present"
            results.append(DiscoveredToken(
                service=self.service,
                source=self.source,
                path=f"env:{var_name}",
                account_hint=None,
                stealth_score=self.stealth_score,
                details=f"token={preview} (from ${var_name})",
            ))

        # 3. macOS Keychain (standalone check — not tied to config file)
        # Only if we didn't already find a config entry for gitlab.com
        config_hosts = set()
        if config.exists():
            try:
                for host, _ in self._parse_config_yml(config.read_text()):
                    config_hosts.add(host)
            except Exception:
                pass

        if "gitlab.com" not in config_hosts:
            kc = self._read_keychain("gitlab.com")
            if kc:
                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path="keychain:glab:gitlab.com",
                    account_hint=None,
                    stealth_score=self.stealth_score,
                    details=f"token in keychain (extractable, {kc[:8]}...)",
                ))

        # 4. .netrc
        netrc = self._netrc_path()
        if netrc.exists():
            try:
                text = netrc.read_text()
                netrc_entries = self._parse_netrc(text)
                for machine, login, password in netrc_entries:
                    preview = f"{password[:8]}..." if len(password) > 8 else "present"
                    results.append(DiscoveredToken(
                        service=self.service,
                        source=self.source,
                        path=str(netrc),
                        account_hint=f"{login}@{machine}" if login else machine,
                        stealth_score=self.stealth_score,
                        details=f"token={preview} (from .netrc)",
                    ))
            except Exception as e:
                self._warn(f"Failed to parse {netrc}: {e}")

        return results

    # ------------------------------------------------------------------ #
    # collect()
    # ------------------------------------------------------------------ #

    def collect(self) -> List[CollectedToken]:
        results: List[CollectedToken] = []
        seen_tokens: set = set()  # deduplicate across sources

        # 1. glab config file
        config = self._config_path()
        if config.exists():
            try:
                text = config.read_text()
                entries = self._parse_config_yml(text)
                for host, data in entries:
                    token = data.get("token")
                    token_source = "config"

                    # Fall back to Keychain if no token in config
                    if not token:
                        token = self._read_keychain(host)
                        token_source = "keychain"

                    if not token:
                        continue

                    if token in seen_tokens:
                        continue
                    seen_tokens.add(token)

                    user = data.get("user", "unknown")
                    protocol = data.get("git_protocol", "https")
                    api_host = data.get("api_host", host)

                    results.append(CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        username=user,
                        access_token=secure(token),
                        extra={
                            "host": host,
                            "api_host": api_host,
                            "git_protocol": protocol,
                            "token_source": token_source,
                            "token_type": "glpat" if token.startswith("glpat-") else "other",
                        },
                    ))
            except Exception as e:
                self._warn(f"Failed to collect from {config}: {e}")

        # 2. Environment variables
        env_result = self._read_env()
        if env_result:
            var_name, token = env_result
            if token not in seen_tokens:
                seen_tokens.add(token)
                results.append(CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    username=None,
                    access_token=secure(token),
                    extra={
                        "host": "gitlab.com",
                        "token_source": "env",
                        "env_var": var_name,
                        "token_type": "glpat" if token.startswith("glpat-") else "other",
                    },
                ))

        # 3. macOS Keychain (standalone — for gitlab.com if not already collected)
        kc = self._read_keychain("gitlab.com")
        if kc and kc not in seen_tokens:
            seen_tokens.add(kc)
            results.append(CollectedToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                username=None,
                access_token=secure(kc),
                extra={
                    "host": "gitlab.com",
                    "token_source": "keychain",
                    "token_type": "glpat" if kc.startswith("glpat-") else "other",
                },
            ))

        # 4. .netrc
        netrc = self._netrc_path()
        if netrc.exists():
            try:
                text = netrc.read_text()
                netrc_entries = self._parse_netrc(text)
                for machine, login, password in netrc_entries:
                    if password in seen_tokens:
                        continue
                    seen_tokens.add(password)

                    results.append(CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        username=login or None,
                        access_token=secure(password),
                        extra={
                            "host": machine,
                            "token_source": "netrc",
                            "token_type": "glpat" if password.startswith("glpat-") else "other",
                        },
                    ))
            except Exception as e:
                self._warn(f"Failed to collect from {netrc}: {e}")

        return results
