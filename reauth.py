"""Re-authenticate with all required scopes and save token.json"""
import json
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/devstorage.full_control",
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
    "https://www.googleapis.com/auth/cloud-platform",
]

flow = InstalledAppFlow.from_client_secrets_file(".secrets/client_secret.json", SCOPES)
creds = flow.run_local_server(port=0)

token_data = {
    "token": creds.token,
    "refresh_token": creds.refresh_token,
    "client_id": creds.client_id,
    "client_secret": creds.client_secret,
    "token_uri": creds.token_uri,
}

with open(".secrets/token.json", "w") as f:
    json.dump(token_data, f, indent=2)

print("Token saved! Scopes granted:")
for s in creds.scopes or SCOPES:
    print(f"  - {s}")
