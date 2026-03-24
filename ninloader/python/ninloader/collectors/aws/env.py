"""AWS environment variable collector — reads AWS_ACCESS_KEY_ID, etc. from env."""

from __future__ import annotations

import os
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure


@CollectorRegistry.register
class AwsEnvCollector(BaseCollector):
    service = "aws"
    source = "env"
    stealth_score = 5

    def discover(self) -> List[DiscoveredToken]:
        key_id = os.environ.get("AWS_ACCESS_KEY_ID")
        if not key_id:
            return []

        return [DiscoveredToken(
            service=self.service,
            source=self.source,
            account_hint=f"key_id={key_id[:8]}...",
            stealth_score=self.stealth_score,
            details="environment variable",
        )]

    def collect(self) -> List[CollectedToken]:
        key_id = os.environ.get("AWS_ACCESS_KEY_ID")
        secret = os.environ.get("AWS_SECRET_ACCESS_KEY")

        if not key_id or not secret:
            return []

        session = os.environ.get("AWS_SESSION_TOKEN")
        region = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")

        extra = {}
        if session:
            extra["session_token"] = session
        if region:
            extra["region"] = region

        profile = os.environ.get("AWS_PROFILE")
        if profile:
            extra["profile"] = profile

        return [CollectedToken(
            service=self.service,
            source=self.source,
            stealth_score=self.stealth_score,
            account_id=key_id,
            username=f"env:{key_id[:8]}...",
            access_token=secure(key_id),
            client_secret=secure(secret),
            extra=extra,
        )]
