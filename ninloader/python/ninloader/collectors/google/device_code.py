"""Google OAuth device code flow collector — requires google-auth-oauthlib."""

from __future__ import annotations

from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken

try:
    import google_auth_oauthlib  # noqa: F401
    _OAUTH_AVAILABLE = True
except ImportError:
    _OAUTH_AVAILABLE = False


@CollectorRegistry.register
class GoogleDeviceCodeCollector(BaseCollector):
    service = "google"
    source = "device_code"
    stealth_score = 3
    requires = ["google-auth-oauthlib"]

    def discover(self) -> List[DiscoveredToken]:
        """Device code flow is always 'available' — it's an interactive flow."""
        return [DiscoveredToken(
            service=self.service,
            source=self.source,
            stealth_score=self.stealth_score,
            details="interactive OAuth device code flow" + (
                " (google-auth-oauthlib not installed)" if not _OAUTH_AVAILABLE else ""
            ),
        )]

    def collect(self) -> List[CollectedToken]:
        if not _OAUTH_AVAILABLE:
            self._warn("google-auth-oauthlib not installed. Install with: pip install google-auth-oauthlib")
            return []

        self._warn("Google device code flow not yet implemented")
        return []
