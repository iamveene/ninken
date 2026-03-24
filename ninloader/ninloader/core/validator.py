"""JWT decoding and token expiry checking — zero external dependencies."""

from __future__ import annotations

import base64
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from ..types import CollectedToken, ValidationResult


def decode_jwt_payload(token: str) -> Optional[Dict[str, Any]]:
    """Decode a JWT payload without signature verification.

    This is intentional — we're inspecting tokens we already possess,
    not verifying tokens from untrusted sources.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        # Add padding
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes)
    except Exception:
        return None


def check_expiry(token: CollectedToken) -> Tuple[bool, Optional[str]]:
    """Check if a token is expired.

    Returns (expired: bool, expires_at: str|None).
    Checks token.expires_at first, then attempts JWT exp claim.
    """
    now = time.time()

    # Check explicit expires_at
    if token.expires_at:
        try:
            exp_dt = datetime.fromisoformat(token.expires_at.replace("Z", "+00:00"))
            expired = exp_dt.timestamp() < now
            return expired, token.expires_at
        except (ValueError, AttributeError):
            pass

    # Try JWT exp claim from access_token
    if token.access_token:
        payload = decode_jwt_payload(token.access_token.value)
        if payload and "exp" in payload:
            exp_ts = payload["exp"]
            exp_dt = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
            expired = exp_ts < now
            return expired, exp_dt.isoformat()

    return False, None


def validate_token(token: CollectedToken) -> ValidationResult:
    """Validate a collected token — check structure and expiry."""
    # Must have at least one credential
    has_access = token.access_token and token.access_token.value
    has_refresh = token.refresh_token and token.refresh_token.value
    has_secret = token.client_secret and token.client_secret.value

    if not has_access and not has_refresh and not has_secret:
        return ValidationResult(
            valid=False,
            service=token.service,
            source=token.source,
            account_hint=token.username,
            error="No token material found",
        )

    expired, expires_at = check_expiry(token)

    # If only a refresh token, it's valid even if access is expired
    if expired and has_refresh:
        return ValidationResult(
            valid=True,
            service=token.service,
            source=token.source,
            account_hint=token.username,
            expires_at=expires_at,
            expired=True,
            error="Access token expired but refresh token available",
        )

    if expired:
        return ValidationResult(
            valid=False,
            service=token.service,
            source=token.source,
            account_hint=token.username,
            expires_at=expires_at,
            expired=True,
            error="Token expired",
        )

    return ValidationResult(
        valid=True,
        service=token.service,
        source=token.source,
        account_hint=token.username,
        expires_at=expires_at,
    )
