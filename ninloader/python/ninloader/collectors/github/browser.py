"""GitHub browser session cookie collector — requires cryptography for extraction."""

from __future__ import annotations

from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...platform_utils import chrome_user_data_dir

try:
    import cryptography  # noqa: F401
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False


@CollectorRegistry.register
class GithubBrowserCollector(BaseCollector):
    service = "github"
    source = "browser"
    stealth_score = 5
    requires = ["cryptography"]

    def discover(self) -> List[DiscoveredToken]:
        """Check if Chrome Cookies DB exists with github.com entries."""
        results = []
        chrome_dir = chrome_user_data_dir()

        # Check Default and numbered profiles
        profiles = ["Default"] + [f"Profile {i}" for i in range(1, 10)]
        for profile in profiles:
            cookies_db = chrome_dir / profile / "Cookies"
            if cookies_db.exists():
                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(cookies_db),
                    account_hint=f"chrome:{profile}",
                    stealth_score=self.stealth_score,
                    details="requires cryptography for extraction",
                ))
                break  # Only report first found profile

        return results

    def collect(self) -> List[CollectedToken]:
        missing = self.check_dependencies()
        if missing:
            self._warn(f"Missing dependencies: {', '.join(missing)}. Install with: pip install {' '.join(missing)}")
            return []

        # Full cookie extraction would go here
        self._warn("Browser cookie extraction not yet implemented — use discover() to locate sources")
        return []
