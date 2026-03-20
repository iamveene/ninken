"""macOS Keychain Microsoft token collector — uses security CLI."""

from __future__ import annotations

import subprocess
import re
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure


@CollectorRegistry.register
class MacosKeychainCollector(BaseCollector):
    service = "microsoft"
    source = "keychain"
    platforms = ["macos"]
    stealth_score = 4
    requires = ["cryptography"]

    def discover(self) -> List[DiscoveredToken]:
        """Check if Microsoft-related keychain entries exist using security CLI."""
        results = []
        try:
            # Search for Microsoft-related keychain items (this may prompt for permission)
            proc = subprocess.run(
                ["security", "dump-keychain"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if proc.returncode == 0:
                output = proc.stdout
                # Look for Microsoft-related entries
                ms_patterns = ["com.microsoft", "microsoftonline", "login.windows.net", "msal"]
                for pattern in ms_patterns:
                    if pattern.lower() in output.lower():
                        results.append(DiscoveredToken(
                            service=self.service,
                            source=self.source,
                            stealth_score=self.stealth_score,
                            details=f"Keychain entry matching '{pattern}' found",
                        ))
                        break
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
            self._warn(f"Could not query keychain: {e}")

        return results

    def collect(self) -> List[CollectedToken]:
        missing = self.check_dependencies()
        if missing:
            self._warn(f"Missing dependencies: {', '.join(missing)}")
            return []

        self._warn("Keychain token extraction not yet implemented — requires user approval dialog")
        return []
