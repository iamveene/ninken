"""Collector registry — central index of all token collectors."""

from __future__ import annotations

from typing import Dict, Optional, Tuple, Type

from .base import BaseCollector


class CollectorRegistry:
    """Registry of all available collectors, keyed by (service, source)."""

    _REGISTRY: Dict[Tuple[str, str], Type[BaseCollector]] = {}

    @classmethod
    def register(cls, collector_cls: Type[BaseCollector]) -> Type[BaseCollector]:
        """Register a collector class. Can be used as a decorator."""
        key = (collector_cls.service, collector_cls.source)
        cls._REGISTRY[key] = collector_cls
        return collector_cls

    @classmethod
    def get(cls, service: str, source: str) -> Optional[Type[BaseCollector]]:
        """Get a specific collector by service and source."""
        return cls._REGISTRY.get((service, source))

    @classmethod
    def get_all(cls) -> Dict[Tuple[str, str], Type[BaseCollector]]:
        """Return all registered collectors."""
        return dict(cls._REGISTRY)

    @classmethod
    def get_by_service(cls, service: str) -> Dict[str, Type[BaseCollector]]:
        """Return all collectors for a given service."""
        return {
            src: coll
            for (svc, src), coll in cls._REGISTRY.items()
            if svc == service
        }


# Import all collector modules to trigger registration
def _load_collectors():
    """Import all collector subpackages to trigger @register decorators."""
    from . import aws  # noqa: F401
    from . import github  # noqa: F401
    from . import google  # noqa: F401
    from . import microsoft  # noqa: F401
    from . import slack  # noqa: F401
    from . import gitlab  # noqa: F401
    from . import chrome  # noqa: F401


_load_collectors()
