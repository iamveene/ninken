"""
Re-authenticate with Microsoft 365 via device code flow and save token.json

Uses the Microsoft Teams client_id (FOCI app) so the refresh token can be
exchanged for access tokens to ANY FOCI-family app:
  - Outlook, OneDrive, SharePoint, Teams, Azure Portal, etc.

Usage:
  pip install msal
  python reauth_microsoft.py [--tenant TENANT_ID] [--account EMAIL]

Defaults to Netxar tenant. Use --tenant common for any account.
"""
import json
import sys
import argparse
import msal

# --- FOCI client IDs (first-party Microsoft apps, no client_secret needed) ---
FOCI_CLIENTS = {
    "teams": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
    "office": "d3590ed6-52b3-4102-aeff-aad2292ab01c",
    "outlook_mobile": "27922004-5251-4030-b22d-91ecd9a37ea4",
    "onedrive": "ab9b8c07-8f02-4f72-87fa-80105867a763",
    "azure_cli": "04b07795-a71b-4346-935f-02f9a1efa4ce",
}

# Default: Teams client_id (FOCI member, broad default scopes)
DEFAULT_CLIENT_ID = FOCI_CLIENTS["teams"]

# Scopes for Graph API — .default gets all consented permissions
# Note: offline_access, openid, profile are added automatically by MSAL
SCOPES = ["https://graph.microsoft.com/.default"]

# Known tenants
TENANTS = {
    "netxar": "727ed07c-9710-40a6-a319-23c26eb256eb",
    "richter": "93010982-9c9c-41eb-86b2-f23083c05e72",
}


def main():
    parser = argparse.ArgumentParser(description="Get Microsoft 365 refresh token via device code flow")
    parser.add_argument("--tenant", default="netxar", help="Tenant ID or name (netxar, richter, common)")
    parser.add_argument("--account", default="marcos.vinicius@netxar.com", help="Account hint for login")
    parser.add_argument("--client", default="teams", help=f"FOCI client to use: {', '.join(FOCI_CLIENTS.keys())}")
    parser.add_argument("--output", default=".secrets/microsoft/token.json", help="Output file path")
    args = parser.parse_args()

    tenant_id = TENANTS.get(args.tenant, args.tenant)
    client_id = FOCI_CLIENTS.get(args.client, args.client)
    authority = f"https://login.microsoftonline.com/{tenant_id}"

    print(f"Tenant:    {tenant_id}")
    print(f"Client:    {args.client} ({client_id})")
    print(f"Authority: {authority}")
    print(f"Account:   {args.account}")
    print()

    app = msal.PublicClientApplication(client_id, authority=authority)

    # Initiate device code flow
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        print(f"Failed to create device flow: {flow.get('error_description', 'Unknown error')}")
        sys.exit(1)

    print(flow["message"])
    print()

    # Wait for user to complete authentication
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" not in result:
        print(f"Authentication failed: {result.get('error_description', result.get('error', 'Unknown error'))}")
        sys.exit(1)

    # Extract token data
    token_data = {
        "platform": "microsoft",
        "account": args.account,
        "tenant_id": tenant_id,
        "client_id": client_id,
        "client_name": args.client,
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
        "id_token_claims": result.get("id_token_claims"),
        "token_type": result.get("token_type"),
        "expires_in": result.get("expires_in"),
        "scope": result.get("scope", "").split(),
        "token_uri": f"{authority}/oauth2/v2.0/token",
        "foci": True,
        "foci_note": "This refresh token can be exchanged for access tokens to any FOCI app (Teams, Outlook, OneDrive, SharePoint, Azure Portal)",
    }

    with open(args.output, "w") as f:
        json.dump(token_data, f, indent=2)

    print(f"\nToken saved to {args.output}")
    print(f"Scopes granted: {token_data['scope']}")
    print(f"Refresh token: {'present' if token_data.get('refresh_token') else 'MISSING'}")

    if token_data.get("id_token_claims"):
        claims = token_data["id_token_claims"]
        print(f"User: {claims.get('preferred_username', 'N/A')}")
        print(f"Name: {claims.get('name', 'N/A')}")
        print(f"OID:  {claims.get('oid', 'N/A')}")
        print(f"TID:  {claims.get('tid', 'N/A')}")


if __name__ == "__main__":
    main()
