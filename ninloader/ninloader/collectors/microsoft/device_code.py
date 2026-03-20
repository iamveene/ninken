"""Microsoft FOCI device code flow collector — interactive token acquisition via MSAL."""

from __future__ import annotations

import json
import sys
from typing import List, Optional

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken, RefreshResult
from ...secure import secure

try:
    import msal
    _MSAL_AVAILABLE = True
except ImportError:
    _MSAL_AVAILABLE = False

# FOCI (Family of Client IDs) — first-party Microsoft apps, no client_secret needed.
# A refresh token from any FOCI app can be exchanged for tokens to ANY other FOCI app.
FOCI_CLIENTS = {
    "teams": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
    "office": "d3590ed6-52b3-4102-aeff-aad2292ab01c",
    "outlook_mobile": "27922004-5251-4030-b22d-91ecd9a37ea4",
    "onedrive": "ab9b8c07-8f02-4f72-87fa-80105867a763",
    "azure_cli": "04b07795-a71b-4346-935f-02f9a1efa4ce",
}

DEFAULT_CLIENT_ID = FOCI_CLIENTS["teams"]
DEFAULT_SCOPES = ["https://graph.microsoft.com/.default"]


@CollectorRegistry.register
class MicrosoftDeviceCodeCollector(BaseCollector):
    service = "microsoft"
    source = "device_code"
    stealth_score = 3
    requires = ["msal"]

    def discover(self) -> List[DiscoveredToken]:
        """Device code flow is always 'available' — it's an interactive flow."""
        return [DiscoveredToken(
            service=self.service,
            source=self.source,
            stealth_score=self.stealth_score,
            details="interactive FOCI device code flow" + (
                " (msal not installed)" if not _MSAL_AVAILABLE else ""
            ),
        )]

    def collect(
        self,
        tenant_id: str = "common",
        client_name: str = "teams",
        scopes: Optional[List[str]] = None,
        account_hint: Optional[str] = None,
    ) -> List[CollectedToken]:
        if not _MSAL_AVAILABLE:
            self._warn("msal not installed. Install with: pip install msal")
            return []

        client_id = FOCI_CLIENTS.get(client_name, client_name)
        authority = f"https://login.microsoftonline.com/{tenant_id}"
        use_scopes = scopes or DEFAULT_SCOPES

        self._info(f"Starting device code flow (client={client_name}, tenant={tenant_id})")

        try:
            app = msal.PublicClientApplication(client_id, authority=authority)
            flow = app.initiate_device_flow(scopes=use_scopes)

            if "user_code" not in flow:
                self._warn(f"Failed to initiate device flow: {flow.get('error_description', 'Unknown')}")
                return []

            # Print the device code message for the user
            print(flow["message"], file=sys.stderr)

            # Block until the user completes authentication
            result = app.acquire_token_by_device_flow(flow)

            if "access_token" not in result:
                self._warn(f"Authentication failed: {result.get('error_description', result.get('error', 'Unknown'))}")
                return []

            claims = result.get("id_token_claims", {})

            return [CollectedToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                account_id=claims.get("oid"),
                username=claims.get("preferred_username", account_hint),
                display_name=claims.get("name"),
                tenant_id=claims.get("tid", tenant_id),
                access_token=secure(result["access_token"]),
                refresh_token=secure(result.get("refresh_token", "")),
                client_id=client_id,
                token_uri=f"{authority}/oauth2/v2.0/token",
                scopes=result.get("scope", "").split() if isinstance(result.get("scope"), str) else result.get("scope", []),
                foci=True,
                extra={
                    "client_name": client_name,
                    "token_type": result.get("token_type"),
                    "foci_clients": FOCI_CLIENTS,
                },
            )]
        except Exception as e:
            self._warn(f"Device code flow failed: {e}")
            return []

    def refresh(self, token: CollectedToken) -> RefreshResult:
        """Refresh a Microsoft FOCI token using the refresh_token."""
        if not _MSAL_AVAILABLE:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error="msal not installed",
            )

        if not token.refresh_token:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error="No refresh token available",
            )

        client_id = token.client_id or DEFAULT_CLIENT_ID
        tenant_id = token.tenant_id or "common"
        authority = f"https://login.microsoftonline.com/{tenant_id}"

        try:
            app = msal.PublicClientApplication(client_id, authority=authority)
            result = app.acquire_token_by_refresh_token(
                token.refresh_token.value,
                scopes=DEFAULT_SCOPES,
            )

            if "access_token" not in result:
                return RefreshResult(
                    success=False,
                    service=self.service,
                    source=self.source,
                    error=result.get("error_description", "Refresh failed"),
                )

            claims = result.get("id_token_claims", {})
            new_token = CollectedToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                account_id=claims.get("oid") or token.account_id,
                username=claims.get("preferred_username") or token.username,
                display_name=claims.get("name") or token.display_name,
                tenant_id=claims.get("tid") or tenant_id,
                access_token=secure(result["access_token"]),
                refresh_token=secure(result.get("refresh_token", token.refresh_token.value)),
                client_id=client_id,
                token_uri=f"{authority}/oauth2/v2.0/token",
                scopes=result.get("scope", "").split() if isinstance(result.get("scope"), str) else result.get("scope", []),
                foci=True,
            )

            return RefreshResult(
                success=True,
                service=self.service,
                source=self.source,
                new_token=new_token,
            )
        except Exception as e:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error=str(e),
            )
