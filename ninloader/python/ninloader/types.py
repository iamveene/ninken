"""Core data types for NinLoader token collection pipeline."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .secure import SecureString, secure


@dataclass
class DiscoveredToken:
    """A token source that was found but not yet extracted."""

    service: str
    source: str
    path: Optional[str] = None
    account_hint: Optional[str] = None
    stealth_score: int = 5
    details: Optional[str] = None

    def summary(self) -> str:
        parts = [f"[{self.service}/{self.source}]"]
        if self.account_hint:
            parts.append(self.account_hint)
        if self.path:
            parts.append(f"@ {self.path}")
        if self.details:
            parts.append(f"({self.details})")
        parts.append(f"stealth={self.stealth_score}")
        return " ".join(parts)


@dataclass
class CollectedToken:
    """A fully extracted token ready for output."""

    service: str
    source: str
    stealth_score: int = 5
    collected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Account identification
    account_id: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None

    # Token material (wrapped in SecureString)
    access_token: Optional[SecureString] = None
    refresh_token: Optional[SecureString] = None
    client_id: Optional[str] = None
    client_secret: Optional[SecureString] = None
    token_uri: Optional[str] = None
    scopes: Optional[List[str]] = None
    expires_at: Optional[str] = None

    # Microsoft FOCI flag
    foci: bool = False

    # Extra provider-specific data
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_ninken_dict(self) -> Dict[str, Any]:
        """Produce the universal Ninken token exchange format."""
        return {
            "ninloader_version": "1.0",
            "collected_at": self.collected_at,
            "collector": {
                "service": self.service,
                "source": self.source,
                "stealth_score": self.stealth_score,
            },
            "account": {
                "id": self.account_id,
                "username": self.username,
                "display_name": self.display_name,
                "tenant_id": self.tenant_id,
                "tenant_name": self.tenant_name,
            },
            "token": {
                "platform": self.service,
                "access_token": self.access_token.value if self.access_token else None,
                "refresh_token": self.refresh_token.value if self.refresh_token else None,
                "client_id": self.client_id,
                "client_secret": self.client_secret.value if self.client_secret else None,
                "token_uri": self.token_uri,
                "scopes": self.scopes,
                "expires_at": self.expires_at,
                "foci": self.foci,
                "extra": self.extra,
            },
        }

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON with plaintext token values."""
        return json.dumps(self.to_ninken_dict(), indent=indent, default=str)


@dataclass
class ValidationResult:
    """Result of validating a token."""

    valid: bool
    service: str
    source: str
    account_hint: Optional[str] = None
    expires_at: Optional[str] = None
    expired: bool = False
    error: Optional[str] = None

    def summary(self) -> str:
        status = "VALID" if self.valid else "INVALID"
        if self.expired:
            status = "EXPIRED"
        parts = [f"[{status}] {self.service}/{self.source}"]
        if self.account_hint:
            parts.append(self.account_hint)
        if self.expires_at:
            parts.append(f"expires={self.expires_at}")
        if self.error:
            parts.append(f"error={self.error}")
        return " ".join(parts)


@dataclass
class RefreshResult:
    """Result of refreshing a token."""

    success: bool
    service: str
    source: str
    new_token: Optional[CollectedToken] = None
    error: Optional[str] = None

    def summary(self) -> str:
        status = "OK" if self.success else "FAIL"
        parts = [f"[{status}] {self.service}/{self.source}"]
        if self.error:
            parts.append(f"error={self.error}")
        return " ".join(parts)
