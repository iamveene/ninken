#!/bin/bash
# Re-authorize Google OAuth with all scopes (including Chat)
# Usage: ./scripts/reauth-google.sh

CLIENT_ID="960873803545-bg5hmu2q6hg2m7buq74a7gvcb0bqafm7.apps.googleusercontent.com"
CLIENT_SECRET="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"
REDIRECT_URI="http://localhost"
TOKEN_FILE="secrets/google/token.json"

SCOPES="https://www.googleapis.com/auth/gmail.modify"
SCOPES="$SCOPES https://www.googleapis.com/auth/gmail.readonly"
SCOPES="$SCOPES https://www.googleapis.com/auth/gmail.compose"
SCOPES="$SCOPES https://www.googleapis.com/auth/gmail.send"
SCOPES="$SCOPES https://www.googleapis.com/auth/drive"
SCOPES="$SCOPES https://www.googleapis.com/auth/calendar"
SCOPES="$SCOPES https://www.googleapis.com/auth/cloud-platform"
SCOPES="$SCOPES https://www.googleapis.com/auth/devstorage.full_control"
SCOPES="$SCOPES https://www.googleapis.com/auth/admin.directory.user.readonly"
SCOPES="$SCOPES https://www.googleapis.com/auth/admin.directory.group.readonly"
SCOPES="$SCOPES https://www.googleapis.com/auth/chat.messages.readonly"
SCOPES="$SCOPES https://www.googleapis.com/auth/chat.spaces.readonly"

# URL-encode scopes (replace spaces with %20)
ENCODED_SCOPES=$(echo "$SCOPES" | sed 's/ /%20/g')

AUTH_URL="https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${ENCODED_SCOPES}&access_type=offline&prompt=consent"

echo ""
echo "=== Ninken Google Re-Authorization ==="
echo ""
echo "1. Open this URL in your browser:"
echo ""
echo "$AUTH_URL"
echo ""
echo "2. Sign in and grant all permissions"
echo "3. You'll be redirected to http://localhost?code=XXXX"
echo "   (the page won't load — that's expected)"
echo "4. Copy the 'code' value from the URL bar"
echo ""
read -p "Paste the code here: " AUTH_CODE

if [ -z "$AUTH_CODE" ]; then
  echo "No code provided. Aborting."
  exit 1
fi

echo ""
echo "Exchanging code for token..."

RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -d "code=${AUTH_CODE}" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "grant_type=authorization_code")

# Check for error
if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'refresh_token' in d else 1)" 2>/dev/null; then
  # Build the token.json in Ninken format
  python3 -c "
import json, sys
data = json.loads('''$RESPONSE''')
token = {
    'token': data.get('access_token', ''),
    'refresh_token': data['refresh_token'],
    'client_id': '$CLIENT_ID',
    'client_secret': '$CLIENT_SECRET',
    'token_uri': 'https://oauth2.googleapis.com/token'
}
print(json.dumps(token, indent=2))
" > "$TOKEN_FILE"

  echo ""
  echo "Token saved to $TOKEN_FILE"
  echo ""
  echo "Verifying scopes..."
  ACCESS_TOKEN=$(python3 -c "import json; print(json.loads('''$RESPONSE''')['access_token'])")
  curl -s "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${ACCESS_TOKEN}" | python3 -c "
import sys, json
info = json.load(sys.stdin)
scopes = info.get('scope', '').split()
print(f'Granted {len(scopes)} scopes:')
for s in sorted(scopes):
    name = s.split('/')[-1]
    print(f'  - {name}')
"
  echo ""
  echo "Done! Load $TOKEN_FILE in the Ninken UI."
else
  echo ""
  echo "Error exchanging code:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
