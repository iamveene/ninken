"""BaseCollector ABC — all collectors inherit from this."""

from __future__ import annotations

import sys
from abc import ABC, abstractmethod
from typing import ClassVar, List, Optional, Sequence

from ..types import CollectedToken, DiscoveredToken, RefreshResult
from ..platform_utils import get_platform


class BaseCollector(ABC):
    """Abstract base class for token collectors.

    Every collector declares:
      - service: which service it collects from (aws, google, github, etc.)
      - source: specific source (env, credentials, browser, etc.)
      - platforms: list of supported platforms (empty = all platforms)
      - requires: list of optional Python packages needed for collect()
      - stealth_score: 1-5 (5 = file read only, 1 = network+interactive)
    """

    service: ClassVar[str]
    source: ClassVar[str]
    platforms: ClassVar[List[str]] = []  # empty = all platforms
    requires: ClassVar[List[str]] = []
    stealth_score: ClassVar[int] = 5

    def is_platform_supported(self) -> bool:
        """Check if this collector runs on the current platform."""
        if not self.platforms:
            return True
        return get_platform() in self.platforms

    def check_dependencies(self) -> List[str]:
        """Return list of missing optional dependencies."""
        missing = []
        for pkg in self.requires:
            try:
                __import__(pkg.replace("-", "_"))
            except ImportError:
                missing.append(pkg)
        return missing

    @abstractmethod
    def discover(self) -> List[DiscoveredToken]:
        """Discover token sources without extracting them.

        This must work with stdlib only — no optional deps.
        Returns a list of DiscoveredToken for each source found.
        MUST NOT raise exceptions.
        """

    @abstractmethod
    def collect(self) -> List[CollectedToken]:
        """Extract tokens from discovered sources.

        May use optional deps. Returns empty list with _warn() on failure.
        MUST NOT raise exceptions.
        """

    def validate(self, token: CollectedToken) -> bool:
        """Validate a collected token. Override for service-specific checks."""
        from ..core.validator import validate_token
        result = validate_token(token)
        return result.valid

    def refresh(self, token: CollectedToken) -> RefreshResult:
        """Refresh a collected token. Override for service-specific refresh."""
        return RefreshResult(
            success=False,
            service=self.service,
            source=self.source,
            error="Refresh not implemented for this collector",
        )

    def _warn(self, message: str) -> None:
        """Log a warning to stderr."""
        print(f"[WARN] [{self.service}/{self.source}] {message}", file=sys.stderr)

    def _info(self, message: str) -> None:
        """Log an info message to stderr."""
        print(f"[INFO] [{self.service}/{self.source}] {message}", file=sys.stderr)
