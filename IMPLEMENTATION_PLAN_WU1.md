# WU-1 Implementation Plan: Microsoft PRT + Browser Session Strategies

## Overview

Add three new credential strategies for Microsoft 365 Phase 2:
1. **PRT Exchange** (`microsoft-prt.ts`) — Primary Refresh Token with session key
2. **PRT Cookie Injection** (`microsoft-prt-cookie.ts`) — Pre-built PRT cookie for SSO
3. **Browser Session** (`microsoft-browser-session.ts`) — ESTSAUTHPERSISTENT cookie

## Detection Differentiation

Each strategy must detect its own credential format without overlapping:

| Strategy | Unique Markers | Excludes |
|---|---|---|
| PRT Exchange | `{ prt, session_key }` or `token_type === "prt"` | No `prt_cookie`, no `estsauthpersistent` |
| PRT Cookie | `x-ms-RefreshTokenCredential` key or `token_type === "prt_cookie"` | No raw `prt`+`session_key` combo |
| Browser Session | `estsauthpersistent` key or `token_type === "browser_session"` | No `prt`, no `prt_cookie` |

Detection priority: PRT > PRT Cookie > Browser Session (order in strategies array matters since `strategies.find()` picks the first match).

## Type Additions (`types.ts`)

```typescript
// CredentialKind union: add "prt" | "prt-cookie"
// ("browser-session" already exists)

// MicrosoftPrtCredential
{
  provider: "microsoft"
  credentialKind: "prt"
  prt: string
  session_key: string  // base64-encoded HMAC key
  tenant_id: string
  client_id?: string
}

// MicrosoftPrtCookieCredential
{
  provider: "microsoft"
  credentialKind: "prt-cookie"
  prt_cookie: string  // The x-ms-RefreshTokenCredential value
  tenant_id: string
  client_id?: string
}

// MicrosoftBrowserSessionCredential
{
  provider: "microsoft"
  credentialKind: "browser-session"
  estsauthpersistent: string
  tenant_id?: string
  client_id?: string
}
```

## PRT Exchange Flow (`microsoft-prt.ts`)

1. Decode session_key from base64
2. Import as HMAC-SHA256 CryptoKey via Web Crypto
3. Build JWT assertion:
   - Header: `{ alg: "HS256" }`
   - Payload: `{ iss: client_id, request_nonce: <uuid>, scope: "openid", grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", iat: now, exp: now+300 }`
   - Sign with HMAC-SHA256 using session_key
4. POST to `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`:
   - `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`
   - `assertion=<signed_jwt>`
   - `client_id=<client_id>`
   - `scope=https://graph.microsoft.com/.default`
5. Response contains `access_token` (and possibly `refresh_token`)

## PRT Cookie Flow (`microsoft-prt-cookie.ts`)

1. POST to `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` with:
   - `x-ms-RefreshTokenCredential` header containing the PRT cookie
   - Standard OAuth params: `client_id`, `response_type=code`, `redirect_uri`, `scope`
2. Follow the SSO redirect to capture the authorization code
3. Exchange the code for access_token via standard token endpoint

This is a one-shot credential -- the PRT cookie is consumed and cannot be refreshed.

## Browser Session Flow (`microsoft-browser-session.ts`)

1. POST to `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` with:
   - Cookie header containing `ESTSAUTHPERSISTENT=<value>`
   - Standard silent auth params: `response_type=code`, `prompt=none`, `scope=https://graph.microsoft.com/.default`
2. Follow redirect to capture authorization code
3. Exchange code for access_token

Also one-shot -- the cookie session cannot be refreshed programmatically.

## Edge Cases

- **Expired PRT cookie**: `validate()` accepts it (we can't check expiry without calling the API). `getAccessToken()` will fail with a clear error.
- **Missing tenant_id on browser session**: Use `"common"` as fallback endpoint. tenant_id is optional for browser sessions.
- **Missing client_id**: Default to Teams FOCI client ID (already used in oauth strategy). Import from microsoft-oauth.ts.

## File Changes

1. `src/lib/providers/types.ts` — Add `"prt" | "prt-cookie"` to CredentialKind, add 3 new credential types
2. `src/lib/providers/strategies/microsoft-prt.ts` — New file
3. `src/lib/providers/strategies/microsoft-prt-cookie.ts` — New file
4. `src/lib/providers/strategies/microsoft-browser-session.ts` — New file
5. `src/lib/providers/microsoft.ts` — Import + register 3 new strategies
