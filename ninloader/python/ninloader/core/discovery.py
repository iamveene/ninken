"""Discovery engine — scans all registered collectors for available token sources."""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from ..types import DiscoveredToken
from ..collectors import CollectorRegistry


class DiscoveryEngine:
    """Iterates all registered collectors and runs discover() on each."""

    def run(
        self,
        service_filter: Optional[str] = None,
    ) -> List[DiscoveredToken]:
        """Run discovery across all (or filtered) collectors.

        Returns a list of DiscoveredToken for every token source found.
        """
        results: List[DiscoveredToken] = []

        for key, collector_cls in CollectorRegistry.get_all().items():
            svc, src = key
            if service_filter and svc != service_filter:
                continue

            collector = collector_cls()

            if not collector.is_platform_supported():
                continue

            try:
                discovered = collector.discover()
                results.extend(discovered)
            except Exception:
                # discover() should never raise, but just in case
                pass

        return results

    @staticmethod
    def format_table(tokens: List[DiscoveredToken]) -> str:
        """Format discovered tokens as a human-readable table."""
        if not tokens:
            return "No token sources discovered."

        lines = []
        lines.append(f"{'Service':<12} {'Source':<20} {'Stealth':<8} {'Account':<30} {'Path'}")
        lines.append("-" * 100)

        for t in tokens:
            acct = t.account_hint or ""
            path = t.path or ""
            details = f" ({t.details})" if t.details else ""
            lines.append(
                f"{t.service:<12} {t.source:<20} {t.stealth_score:<8} {acct:<30} {path}{details}"
            )

        lines.append(f"\nTotal: {len(tokens)} token source(s) found")
        return "\n".join(lines)

    @staticmethod
    def format_json(tokens: List[DiscoveredToken]) -> str:
        """Format discovered tokens as machine-readable JSON."""
        data = []
        for t in tokens:
            data.append({
                "service": t.service,
                "source": t.source,
                "path": t.path,
                "account_hint": t.account_hint,
                "stealth_score": t.stealth_score,
                "details": t.details,
            })
        return json.dumps(data, indent=2)
