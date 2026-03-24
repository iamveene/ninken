"""Windows DPAPI Microsoft token collector — decrypts MSAL cache with DPAPI."""

from __future__ import annotations

from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...platform_utils import get_platform


@CollectorRegistry.register
class WindowsDpapiCollector(BaseCollector):
    service = "microsoft"
    source = "dpapi"
    platforms = ["windows"]
    stealth_score = 4
    requires = ["cryptography"]

    def discover(self) -> List[DiscoveredToken]:
        """Check for DPAPI-protected MSAL token caches on Windows."""
        if get_platform() != "windows":
            return []

        import os
        local_appdata = os.environ.get("LOCALAPPDATA", "")
        if not local_appdata:
            return []

        from pathlib import Path
        msal_cache = Path(local_appdata) / "Microsoft" / "TokenBroker" / "Cache"
        if msal_cache.exists():
            return [DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(msal_cache),
                stealth_score=self.stealth_score,
                details="DPAPI-protected MSAL token cache",
            )]

        return []

    def collect(self) -> List[CollectedToken]:
        if get_platform() != "windows":
            return []

        missing = self.check_dependencies()
        if missing:
            self._warn(f"Missing dependencies: {', '.join(missing)}")
            return []

        self._warn("DPAPI token extraction not yet implemented")
        return []
