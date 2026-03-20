"""Token refresh dispatcher — routes refresh requests to the appropriate collector."""

from __future__ import annotations

from typing import Optional

from ..types import CollectedToken, RefreshResult
from ..collectors import CollectorRegistry


def refresh_token(token: CollectedToken) -> RefreshResult:
    """Attempt to refresh a collected token using the appropriate collector.

    Looks up the collector by (service, source) and delegates to its refresh().
    """
    collector_cls = CollectorRegistry.get(token.service, token.source)
    if not collector_cls:
        return RefreshResult(
            success=False,
            service=token.service,
            source=token.source,
            error=f"No collector found for {token.service}/{token.source}",
        )

    collector = collector_cls()

    if not collector.is_platform_supported():
        return RefreshResult(
            success=False,
            service=token.service,
            source=token.source,
            error=f"Collector {token.service}/{token.source} not supported on this platform",
        )

    try:
        return collector.refresh(token)
    except Exception as e:
        return RefreshResult(
            success=False,
            service=token.service,
            source=token.source,
            error=str(e),
        )
