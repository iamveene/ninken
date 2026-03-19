# Google Token Types & API Access — Red Team Research Document

**Project:** Ninken (忍犬) — Universal Red Team Data Explorer
**Date:** 2026-03-19
**Scope:** Comprehensive inventory of Google token types, OAuth scopes, and API access vectors relevant to red team operations and security auditing.
**Current state:** Ninken supports Google OAuth2 user tokens (refresh_token + client_id + client_secret) with scopes for Gmail, Drive, Calendar, Cloud Storage, and Admin Directory.

---

## Table of Contents

1. [OAuth2 User Tokens — Additional Scopes](#1-oauth2-user-tokens--additional-scopes)
2. [Service Account Keys / JWT Tokens](#2-service-account-keys--jwt-tokens)
3. [Domain-Wide Delegation Tokens](#3-domain-wide-delegation-tokens)
4. [API Keys](#4-api-keys)
5. [Google Cloud Platform Tokens](#5-google-cloud-platform-tokens)
6. [Application Default Credentials (ADC)](#6-application-default-credentials-adc)
7. [OAuth Application Credentials](#7-oauth-application-credentials)
8. [Google Workspace Marketplace Tokens](#8-google-workspace-marketplace-tokens)
9. [SAML / OIDC Federation Tokens](#9-saml--oidc-federation-tokens)
10. [Stolen / Harvested Token Types](#10-stolen--harvested-token-types)
11. [Implementation Priority Matrix](#11-implementation-priority-matrix)

---

## 1. OAuth2 User Tokens — Additional Scopes

These all use the same credential shape Ninken already supports (`refresh_token` + `client_id` + `client_secret`). The only difference is which scopes were granted during the OAuth consent flow. Ninken can probe for these scopes on any ingested token using the existing `tokeninfo` endpoint.

### 1.1 Google Admin SDK — Directory API

**Already partially implemented** in Ninken (users + groups listing in Audit mode).

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `admin.directory.user.readonly` | List/read all users in the org | HIGH — full org chart, emails, org units |
| `admin.directory.user` | Create/modify/delete users | CRITICAL — create backdoor accounts |
| `admin.directory.group.readonly` | List/read all groups + members | HIGH — map group-based access controls |
| `admin.directory.group` | Create/modify/delete groups | HIGH — add self to privileged groups |
| `admin.directory.orgunit.readonly` | Read org unit structure | MEDIUM — understand org hierarchy |
| `admin.directory.device.mobile.readonly` | List mobile devices | MEDIUM — device inventory, MDM status |
| `admin.directory.device.chromeos.readonly` | List ChromeOS devices | MEDIUM — endpoint inventory |
| `admin.directory.domain.readonly` | List domains | HIGH — discover all domains in the org |
| `admin.directory.customer.readonly` | Read customer/org info | MEDIUM — org metadata, primary domain |
| `admin.directory.resource.calendar.readonly` | Read calendar resources | LOW — meeting rooms, equipment |
| `admin.directory.rolemanagement.readonly` | List admin roles + assignments | CRITICAL — who has what admin privileges |
| `admin.directory.rolemanagement` | Assign admin roles | CRITICAL — elevate to Super Admin |
| `admin.directory.userschema.readonly` | Custom schema definitions | LOW — custom user attributes structure |

**Implementation complexity:** LOW — Ninken already has `createDirectoryService()` in `src/lib/google.ts`. Additional Admin SDK methods use the same `google.admin()` client. Adding scope probing and additional API routes is straightforward.

**Caveats:**
- Requires the token owner to be an admin (or delegated admin) for most endpoints
- `my_customer` alias works for the token owner's org
- Non-admin users get 403 on most directory endpoints
- Audit mode already handles graceful degradation for this

### 1.2 Google Admin SDK — Reports API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `admin.reports.audit.readonly` | Admin audit activity logs | CRITICAL — who did what and when |
| `admin.reports.usage.readonly` | Usage reports (user + entity) | MEDIUM — usage patterns, last login dates |

**What the Reports API reveals:**
- **Admin Activity**: Every admin console action (user creation, password reset, 2SV changes, group membership changes, OAuth app whitelisting, mobile device wipes)
- **Login Activity**: All login events with IP addresses, device info, success/failure, suspicious login flags
- **Token Activity**: OAuth token grants, third-party app authorizations, token revocations
- **Drive Activity**: File sharing events, permission changes, downloads, external sharing
- **Gmail Activity**: Delegated access events, forwarding rule changes, filter creation
- **Calendar Activity**: Calendar sharing changes, external calendar access
- **Groups Activity**: Group creation, membership changes, access settings

**Implementation complexity:** LOW — Same `google.admin()` client, just `reports_v1` version. REST endpoint: `https://admin.googleapis.com/admin/reports/v1/activity/users/{userKey}/applications/{applicationName}`.

**Red team value:** This is the OPSEC intelligence goldmine. By reading the Reports API, the operator can:
1. See what the SOC is monitoring (active detections)
2. Check if their own API activity has been noticed
3. Understand the org's security posture from audit trail
4. Find other compromised or vulnerable accounts (failed logins, risky apps)

### 1.3 Google Vault API (eDiscovery)

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `ediscovery.readonly` | Read existing matters, holds, exports | HIGH — see what legal/compliance is investigating |
| `ediscovery` | Create matters, holds, search, export | CRITICAL — mass data exfiltration via eDiscovery exports |

**What Google Vault provides:**
- **Matters**: Legal cases/investigations, each scoped to specific users/dates
- **Holds**: Preservation policies preventing data deletion (reveals what data is considered sensitive)
- **Searches**: Run searches across Gmail, Drive, Groups, Chat, Meet, Voice across the entire org
- **Exports**: Bulk export search results — the most powerful data exfiltration vector in Workspace

**Implementation complexity:** MEDIUM — Requires separate client: `google.vault({ version: 'v1' })`. The API has its own resource model (matters, holds, savedQueries, exports). Export results are stored in GCS buckets that can be downloaded.

**Red team value:** CRITICAL. Google Vault is the ultimate lateral search tool:
- Search any user's email by keyword across the entire org
- Export entire mailboxes with a single API call
- Search Drive files across all users
- The exports are complete PST/mbox files, not summary data
- Legal/compliance teams use this tool for the same purpose — bulk data access

**Caveats:**
- Requires Vault license (included in Business Plus, Enterprise, Education Plus)
- Token owner must be a Vault admin or have delegated Vault privileges
- Vault operations are logged in Admin audit logs
- Exports can take hours for large datasets

### 1.4 Google Chat API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `chat.spaces.readonly` | List spaces/rooms the user is in | MEDIUM — discover communication channels |
| `chat.messages.readonly` | Read messages in spaces | HIGH — internal communications, decisions, secrets |
| `chat.messages` | Send messages | MEDIUM — social engineering, impersonation |
| `chat.memberships.readonly` | List members of spaces | MEDIUM — map communication networks |
| `chat.spaces` | Create/update spaces | LOW — less useful for red team |

**Implementation complexity:** LOW — Standard REST API at `https://chat.googleapis.com/v1/`. Uses same OAuth2 flow. `google.chat({ version: 'v1' })`.

**Red team value:** HIGH for intelligence gathering. Chat often contains:
- Credentials shared between team members ("here's the password for...")
- Internal discussions about security incidents
- Links to internal tools and dashboards
- Decision-making context not found in email

**Caveats:**
- Chat API only provides access to spaces the authenticated user is a member of
- DMs require both parties to be in the same org
- No search API for Chat (must paginate through messages)
- Chat history retention may be limited by org policy

### 1.5 Google Meet API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `meetings.space.readonly` | Read meeting space info | LOW |
| `meetings.space.created` | Create meeting spaces | LOW |

**Implementation complexity:** LOW but limited API.

**Red team value:** LOW. The Meet REST API is very limited compared to what you'd expect. It can create/read meeting spaces but cannot access recordings or transcripts via this API. Meeting recordings go to Drive (accessible via Drive API). Transcripts go to Google Docs (accessible via Drive API).

### 1.6 Google Contacts / People API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `contacts.readonly` | Read user's personal contacts | MEDIUM — personal network mapping |
| `contacts` | Read/write contacts | MEDIUM |
| `contacts.other.readonly` | "Other contacts" (auto-saved from email) | HIGH — reveals communication patterns |
| `directory.readonly` | Organization directory (People API) | MEDIUM — lighter-weight alternative to Admin SDK |
| `userinfo.email` | Email address of token owner | LOW — basic identity |
| `userinfo.profile` | Basic profile info | LOW |

**Implementation complexity:** LOW — `google.people({ version: 'v1' })`. Standard REST API.

**Red team value:** MEDIUM-HIGH. "Other contacts" is particularly interesting because Google auto-saves contacts from email interactions, revealing who the user communicates with even if they never explicitly saved the contact. Combined with contact frequency data, this maps the user's professional and personal network.

### 1.7 Google Cloud IAM API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `cloud-platform` | Full GCP access (IAM is a subset) | CRITICAL — full cloud infrastructure control |
| `iam` | IAM policy management | CRITICAL — privilege escalation |

**Key IAM API capabilities:**
- List all IAM policies for projects/folders/orgs
- List service account keys
- Create new service account keys (persistence mechanism)
- List role bindings (who has what access)
- List custom roles and their permissions
- Test IAM permissions (check what the current token can do)
- Manage workload identity pools

**Implementation complexity:** MEDIUM — IAM API calls are project-scoped and require enumerating projects first. Ninken already has Cloud Resource Manager integration for project listing.

**Red team value:** CRITICAL for GCP-heavy organizations:
- `testIamPermissions` on every project reveals exact access level
- Service account key listing reveals persistence mechanisms
- Creating new SA keys is a classic persistence technique
- Understanding IAM bindings maps the entire permission structure

### 1.8 Google Cloud Resource Manager API

**Already partially used** in Ninken's audit overview (project listing).

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `cloud-platform.read-only` | Read projects, folders, org | HIGH — infrastructure map |
| `cloud-platform` | Full resource management | CRITICAL — create/modify projects |

**Additional capabilities beyond current implementation:**
- List org policies (security constraints)
- List folders (organizational structure)
- Get org node (top-level org ID)
- List liens (deletion protections)
- Search across all resources (`searchAllResources`)
- List effective tags and policies

**Implementation complexity:** LOW — already using `cloudresourcemanager.googleapis.com`.

### 1.9 Google Workspace DLP API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `admin.directory.userschema.readonly` (DLP rules via Admin SDK) | Read DLP rules and detectors | HIGH — understand what's monitored |

**What DLP reveals:**
- Data loss prevention rules configured for the org
- What content patterns trigger alerts (credit cards, SSNs, custom patterns)
- Which services are protected (Gmail, Drive, Chat)
- Action on detection (block, warn, audit)

**Implementation complexity:** MEDIUM — DLP settings are accessed through the Admin SDK Alerts Center and Rules API, not a standalone DLP API.

**Red team value:** HIGH for OPSEC. Knowing the DLP rules tells you:
- What data patterns will trigger alerts if you exfiltrate them
- Which channels are monitored vs. unmonitored
- What the org considers sensitive (custom DLP rules)

### 1.10 Chrome Browser Cloud Management (CBCM)

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `admin.directory.device.chromeos.readonly` | ChromeOS device inventory | MEDIUM |
| `chrome.management.policy.readonly` | Chrome browser policies | HIGH — security policy enumeration |
| `chrome.management.reports.readonly` | Chrome usage reports | MEDIUM |

**What CBCM reveals:**
- All managed Chrome browsers and their version/OS/device info
- Chrome policies (extensions blocked/required, safe browsing, etc.)
- Installed extensions across all managed browsers
- Browser enrollment status and tokens

**Implementation complexity:** MEDIUM — Chrome Management API is relatively new. REST endpoint: `https://chromemanagement.googleapis.com/v1/`.

**Red team value:** HIGH for endpoint security assessment:
- Extension inventory reveals security tools (EDR extensions, password managers)
- Policy enumeration shows security posture (is safe browsing enforced? download restrictions?)
- Device inventory maps the endpoint fleet

### 1.11 Google Groups Settings API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `apps.groups.settings` | Read/modify group settings | HIGH — understand who can join, post, discover |

**What Groups Settings reveals per group:**
- Who can view members, post, join
- Whether the group is discoverable
- External member/posting permissions
- Moderation settings
- Archive settings

**Implementation complexity:** LOW — `google.groupssettings({ version: 'v1' })`.

**Red team value:** HIGH for lateral movement planning:
- Find groups that allow external members (join from compromised external account)
- Find groups that allow external posting (phishing vector)
- Discover which groups control access to what resources

### 1.12 Google Drive Activity API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `drive.activity.readonly` | Read Drive activity feed | HIGH — who accessed what, when |

**What Drive Activity reveals:**
- File creation, modification, sharing, deletion events
- Who viewed/edited each file (including external users)
- Permission change history
- Move/rename/copy events with timestamps

**Implementation complexity:** LOW — `google.driveactivity({ version: 'v2' })`.

**Red team value:** HIGH:
- Track who accesses sensitive files
- Understand file sharing patterns
- Detect if your access has been noticed (admin viewing shared files)
- Map data flow patterns

### 1.13 Google Workspace Alert Center API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `apps.alerts` | Read/manage security alerts | CRITICAL — see active security alerts |

**What Alert Center reveals:**
- Active security alerts (suspicious login, leaked password, government-backed attack, DLP violation)
- Alert status (active, dismissed, resolved)
- Alert metadata (affected users, timestamps, details)

**Implementation complexity:** LOW — `google.alertcenter({ version: 'v1beta1' })`.

**Red team value:** CRITICAL for OPSEC:
- See if there are alerts about your activity
- Understand what the security team is responding to
- Discover other compromised accounts the org has detected
- Google's built-in threat detection findings are visible here

### 1.14 Google Cloud Logging API

| Scope | Access | Red Team Value |
|-------|--------|----------------|
| `logging.read` | Read Cloud Audit Logs | HIGH — infrastructure activity trail |
| `cloud-platform` | Full access including logging | CRITICAL |

**What Cloud Logging reveals:**
- All API calls made to GCP services (Admin Activity audit logs)
- Data access audit logs (if enabled)
- System event audit logs
- VPC flow logs, load balancer logs, etc.

**Implementation complexity:** MEDIUM — `google.logging({ version: 'v2' })`. Logs can be massive; need pagination and filtering.

**Red team value:** HIGH:
- Check if your GCP API activity is being monitored
- Find other service accounts and their activity patterns
- Discover infrastructure components from their log entries
- Log sinks reveal where logs are sent (SIEM integration)

### 1.15 Additional Valuable Scopes (Summary Table)

| API | Key Scopes | Red Team Value | Complexity |
|-----|-----------|----------------|------------|
| Cloud Functions | `cloudfunctions` | HIGH — execute code, read source | MEDIUM |
| Cloud Run | `cloud-platform` | HIGH — container access, env vars | MEDIUM |
| Cloud SQL | `sqlservice.admin` | CRITICAL — database access | MEDIUM |
| Secret Manager | `cloud-platform` | CRITICAL — all stored secrets | LOW |
| Cloud KMS | `cloudkms` | CRITICAL — encryption key access | MEDIUM |
| Compute Engine | `compute.readonly` | HIGH — VM inventory, metadata | MEDIUM |
| Kubernetes Engine | `cloud-platform` | CRITICAL — cluster access | HIGH |
| Cloud Build | `cloudbuild` | HIGH — CI/CD pipelines, build secrets | MEDIUM |
| Firestore/Datastore | `datastore` | HIGH — application data | MEDIUM |
| BigQuery | `bigquery` | CRITICAL — data warehouse access | MEDIUM |
| Pub/Sub | `pubsub` | MEDIUM — message queue access | LOW |
| Cloud Scheduler | `cloud-scheduler` | MEDIUM — scheduled jobs (persistence) | LOW |
| Service Management | `service.management.readonly` | MEDIUM — enabled APIs list | LOW |
| Service Usage | `serviceusage.readonly` | MEDIUM — API usage metrics | LOW |

---

## 2. Service Account Keys / JWT Tokens

### What it is
A service account (SA) is a non-human identity in GCP. It has its own email (`name@project-id.iam.gserviceaccount.com`) and can be granted IAM roles. SA keys are JSON files containing a private key used to sign JWTs for authentication.

### Credential format
```json
{
  "type": "service_account",
  "project_id": "my-project",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "sa-name@my-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/sa-name%40my-project.iam.gserviceaccount.com"
}
```

### How authentication works
1. Construct a JWT claim set: `{ iss: client_email, scope: "...", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now+3600 }`
2. Sign the JWT with the private key (RS256)
3. POST to `https://oauth2.googleapis.com/token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion={signed_jwt}`
4. Response contains a standard `access_token` (valid ~1 hour)
5. No refresh token — repeat the JWT signing each time

### What it grants access to
- Any GCP API the service account has IAM bindings for
- Can span multiple projects if cross-project IAM bindings exist
- With domain-wide delegation: can impersonate any user in the Google Workspace domain (see Section 3)

### Red team value: CRITICAL
Service account keys are the most commonly leaked GCP credential:
- Found in git repos, CI/CD configs, environment variables, Terraform state
- They never expire by default (unlike user refresh tokens)
- They can be used from anywhere (no IP restrictions by default)
- One key can access dozens of projects via IAM bindings
- If the SA has `roles/owner` or `roles/editor`, it's game over for that project

### Implementation complexity: MEDIUM
- Auto-detection: Check for `"type": "service_account"` and `"private_key"` fields
- JWT signing: Use `jsonwebtoken` npm package (RS256) or Web Crypto API
- Token exchange: POST to Google's token endpoint with the signed JWT
- Scope selection: Unlike user OAuth, the operator must specify which scopes to request
- UI: Need a scope selector for the operator to choose what access to request

### Ninken implementation plan
```
New credential type in providers/types.ts:
  GoogleServiceAccountCredential = {
    provider: "google"
    type: "service_account"
    project_id: string
    private_key_id: string
    private_key: string
    client_email: string
    client_id: string
    token_uri?: string
  }

Detection: "type" === "service_account" && "private_key" present
Token flow: JWT sign -> token exchange (no refresh token needed)
UI: Same Google nav items, but add a "Scope Selector" panel since SA tokens
    need explicit scope requests
```

### Caveats
- Private keys can be disabled by admins (key rotation)
- Each SA can have max 10 keys
- GCP recommends Workload Identity Federation instead of keys (keyless auth)
- SA keys cannot be used for Google Workspace APIs unless domain-wide delegation is configured
- No way to determine what IAM roles the SA has from the key alone — must probe APIs

---

## 3. Domain-Wide Delegation Tokens

### What it is
Domain-wide delegation (DWD) allows a service account to impersonate any user in a Google Workspace domain. The service account "acts as" the user, accessing their Gmail, Drive, Calendar, etc. This is the mechanism used by third-party apps that need org-wide data access (backup tools, security scanners, SIEM integrations).

### How it's obtained
1. A Google Workspace admin grants the service account DWD permissions in Admin Console (Security > API controls > Domain-wide delegation)
2. The admin specifies which OAuth scopes the SA can request when impersonating users
3. The SA's client_id is added to the DWD allowlist

### How impersonation works
The JWT claim set includes an additional `sub` (subject) field:
```json
{
  "iss": "sa@project.iam.gserviceaccount.com",
  "sub": "target-user@domain.com",        // <-- impersonate this user
  "scope": "https://www.googleapis.com/auth/gmail.readonly",
  "aud": "https://oauth2.googleapis.com/token",
  "iat": 1234567890,
  "exp": 1234571490
}
```
The resulting access token has the permissions of `target-user@domain.com`, not the service account itself.

### What it grants access to
- ANY user's data in the domain (every mailbox, every Drive, every Calendar)
- Scoped to the specific OAuth scopes approved in the DWD configuration
- The impersonated user doesn't know it's happening (no notification, no consent screen)

### Red team value: CRITICAL (highest possible)
DWD is the single most powerful Google Workspace access vector:
- Read every email in every mailbox in the org
- Access every file in every Drive
- Read every calendar
- Impersonate the CEO, CFO, legal counsel — anyone
- The impersonated user sees no indication of the access
- No per-user consent required

**Real-world prevalence:** Many organizations have service accounts with DWD for:
- Email backup/archival tools (Veeam, Spanning, etc.)
- SIEM integrations (pulling audit logs for all users)
- Migration tools
- Custom internal apps

### Implementation complexity: MEDIUM-HIGH
- Same credential format as service account keys
- Need a "user impersonation" UI: text field for target email, scope selector
- JWT signing with `sub` field added
- User enumeration: combine with Admin Directory API to list all users, then offer them as impersonation targets
- Bulk operations: iterate through all users, pulling data from each

### Ninken implementation plan
```
UI flow:
1. Detect service account key with DWD capability
2. Show "Domain-Wide Delegation" panel
3. Allow operator to enter target email (or select from directory listing)
4. Select scopes to request
5. Generate impersonated access token
6. Navigate to standard Gmail/Drive/Calendar views, now operating as the target user
7. Add "Currently impersonating: user@domain.com" banner
8. Support batch operations: "Pull all mailboxes" / "Search all Drives"
```

### Caveats
- DWD only works for users in the same Workspace domain as the SA
- The scopes must be pre-approved in Admin Console — requesting unapproved scopes fails silently
- DWD is logged in Admin audit logs (the SA identity, not the impersonated user, appears in API logs)
- Some organizations disable DWD entirely
- You cannot determine which scopes are DWD-approved from the key alone — must probe
- DWD does not work for consumer Gmail accounts, only Workspace domains

---

## 4. API Keys

### What it is
An API key is a simple string (e.g., `AIzaSyD...`) that identifies a GCP project for quota and billing. It does NOT authenticate a user or service account — it only identifies the calling project.

### How it's obtained
- Created in GCP Console (APIs & Services > Credentials)
- Often hardcoded in client-side JavaScript, mobile apps, config files
- Found in: source code repos, APK decompilation, browser network traffic, environment variables

### What it grants access to
API keys can ONLY be used with APIs that accept unauthenticated requests. Specifically:

| API | What's accessible with just an API key | Red Team Value |
|-----|----------------------------------------|----------------|
| Google Maps (all APIs) | Geocoding, directions, places, street view | LOW — can run up billing |
| YouTube Data API | Public video metadata, channel info, search | LOW |
| Custom Search API | Google search results | LOW |
| Firebase (various) | Depends on Firebase Security Rules | MEDIUM-HIGH |
| Google Fonts API | Font data | NONE |
| Safe Browsing API | URL reputation lookup | NONE |
| Civic Information API | Public election/representative data | NONE |
| Cloud Translation API | Translate text (billed to key owner) | LOW |
| Cloud Vision API | Image analysis (billed to key owner) | LOW |
| Cloud Natural Language | Text analysis (billed to key owner) | LOW |

### Red team value: LOW (generally)
API keys alone are not very valuable because they don't grant access to user data. However:

1. **Firebase API keys** are the exception — if Firebase Security Rules are misconfigured (which is common), an API key + knowledge of the Firestore/RTDB structure can read/write all app data
2. **Billing abuse**: API keys allow running up charges on the key owner's billing account
3. **Information disclosure**: The key reveals the project ID, which can be used for further reconnaissance
4. **Key restrictions**: Many API keys are unrestricted (no IP/referrer/API restrictions), meaning they can be used for any API from anywhere

### Implementation complexity: LOW
- Auto-detection: String starting with `AIza` (40-char alphanumeric)
- No token exchange needed — use directly as `?key=API_KEY` query parameter
- Limited UI needed — mostly a "what can this key do" probe tool

### Ninken implementation plan
For an API key, Ninken would offer a "Key Probe" view:
- Test the key against known APIs (Maps, YouTube, Firebase, Translation, etc.)
- Show which APIs respond successfully
- For Firebase keys: attempt to read Firestore/RTDB collections
- Show project ID and any key restrictions
- Cost: this is a recon/probe tool, not a full data browser

### Caveats
- API keys do NOT grant access to Gmail, Drive, Calendar, Admin SDK, or any user-data API
- Keys can have IP, HTTP referrer, or API restrictions
- Keys can be rotated/deleted instantly by the project owner
- Using a key generates API usage logs tied to the key's project

---

## 5. Google Cloud Platform Tokens

### 5.1 GCP Access Tokens

**What it is:** Short-lived bearer tokens (typically 1 hour) issued by Google's OAuth2 endpoint. These are the tokens that actually make API calls.

**Format:** `ya29.a0...` (opaque string, ~200-2000 chars)

**How obtained:**
- OAuth2 authorization code flow (what Ninken currently uses via refresh token)
- Service account JWT exchange
- Metadata server on GCE/GKE instances (`http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`)
- Workload Identity Federation
- gcloud CLI (`gcloud auth print-access-token`)

**Red team value:** HIGH — direct API access, but short-lived. If you capture one, you have ~1 hour to use it.

**Implementation complexity:** LOW — Ninken already handles these. A standalone access token (without refresh token) could be ingested for short-term use.

**Ninken implementation plan:** Add "Raw Access Token" input option:
- Paste a `ya29.*` token directly
- Probe it with `tokeninfo` to discover scopes, expiry, email
- Show a prominent countdown timer (token is dying)
- No refresh capability — when it expires, it's dead

### 5.2 GCP Refresh Tokens

**Already implemented.** This is Ninken's primary Google credential flow.

### 5.3 GCP Identity Tokens (OIDC ID Tokens)

**What it is:** JWT tokens that prove identity (not access). Used for authenticating to services that validate identity (Cloud Run, Cloud Functions with IAM invoker, Identity-Aware Proxy, etc.).

**Format:** Standard JWT (base64-encoded, three dot-separated parts). Payload contains `email`, `iss` (accounts.google.com), `aud` (target service URL), `exp`.

**How obtained:**
- `gcloud auth print-identity-token`
- Service account JWT exchange with `target_audience` instead of `scope`
- Metadata server: `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=TARGET`

**Red team value:** MEDIUM — useful for accessing Cloud Run services, Cloud Functions, and IAP-protected apps. These are often internal tools that assume "if you have a valid identity token, you're authorized."

**Implementation complexity:** MEDIUM — JWT decoding is straightforward (Ninken already does this for Microsoft tokens). Would need to handle the ID token as a credential type and support calling IAP-protected endpoints.

### 5.4 Workload Identity Federation Tokens

**What it is:** A mechanism to exchange external identity tokens (AWS, Azure, GitHub Actions, OIDC providers) for GCP access tokens without service account keys. The external token is exchanged at Google's STS endpoint for a short-lived GCP access token.

**How obtained:**
- Exchange flow: External token -> Google STS endpoint -> Federated token -> Impersonate SA -> GCP access token
- Config file format: `credential_configuration` JSON with `type: "external_account"` and provider details

**Credential format:**
```json
{
  "type": "external_account",
  "audience": "//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID",
  "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
  "token_url": "https://sts.googleapis.com/v1/token",
  "credential_source": {
    "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME",
    "headers": {"x-metadata-flavor": "Google"}
  },
  "service_account_impersonation_url": "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/SA@PROJECT.iam.gserviceaccount.com:generateAccessToken"
}
```

**Red team value:** MEDIUM — the config file itself reveals the trust chain (which external providers are trusted, which SAs can be impersonated). The actual exchange requires a valid external token.

**Implementation complexity:** HIGH — multi-step token exchange, external provider integration.

### 5.5 GCE Metadata Server Tokens

**What it is:** Any code running on a GCE VM, GKE pod, Cloud Run container, Cloud Function, or App Engine instance can get an access token from the instance metadata server without any credentials.

**How obtained:**
```bash
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```

**Red team value:** CRITICAL in cloud-native attacks:
- SSRF vulnerabilities that reach `169.254.169.254` (metadata IP) can steal tokens
- Container escape scenarios give access to node's service account
- The metadata server also exposes: project ID, service account email, scopes, SSH keys, custom metadata (often containing secrets)

**Implementation complexity:** N/A for Ninken directly (these are captured during the attack, then pasted into Ninken as raw access tokens). However, Ninken could provide a "Metadata Simulator" that accepts SSRF-captured JSON and extracts the token.

---

## 6. Application Default Credentials (ADC)

### What it is
ADC is Google's credential chaining mechanism. When a Google client library initializes without explicit credentials, it searches for credentials in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable (path to a JSON key file)
2. User credentials from `gcloud auth application-default login` (stored at `~/.config/gcloud/application_default_credentials.json`)
3. Attached service account on GCE/GKE/Cloud Run/etc. (metadata server)
4. Workload Identity Federation config

### ADC User Credential Format
```json
{
  "client_id": "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com",
  "client_secret": "d-FL95Q19q7MQmFpd7hHD0Ty",
  "refresh_token": "1//0...",
  "type": "authorized_user"
}
```
Note: The `client_id` and `client_secret` are Google's default OAuth client for gcloud CLI (public knowledge). The valuable part is the `refresh_token`.

### ADC Service Account Format
Same as Section 2 (service account key JSON).

### How obtained (red team perspective)
- File theft from developer workstations: `~/.config/gcloud/application_default_credentials.json`
- Environment variable enumeration: `echo $GOOGLE_APPLICATION_CREDENTIALS`
- Container/VM filesystem access: same paths
- CI/CD pipeline secrets/artifacts

### Red team value: HIGH
ADC credentials are extremely common on developer machines and CI/CD systems. The user variant uses gcloud's own client_id/secret which is broadly scoped. The SA variant is equivalent to a service account key.

### Implementation complexity: LOW
- Auto-detection: Check for `"type": "authorized_user"` with `refresh_token`, or `"type": "service_account"` with `private_key`
- The `authorized_user` type maps directly to Ninken's existing Google OAuth flow (refresh_token + client_id + client_secret)
- Ninken should auto-detect and handle both ADC variants

### Ninken implementation plan
ADC `authorized_user` credentials already work with Ninken's current ingestion — the `client_id`, `client_secret`, and `refresh_token` fields are identical to what Ninken expects. The `type` field should be added to auto-detection for cleaner UX.

### Caveats
- ADC user credentials default to the gcloud CLI's OAuth client, which has limited scopes (primarily `cloud-platform` and `openid`). It does NOT include Gmail, Drive, Calendar scopes by default.
- To get Workspace scopes with ADC, the user must run `gcloud auth application-default login --scopes=...` with additional scopes explicitly.
- SA-type ADC follows the same rules as regular SA keys.

---

## 7. OAuth Application Credentials (Client ID + Client Secret)

### What it is
The OAuth client_id and client_secret identify an application (not a user). They are used to initiate OAuth flows and exchange authorization codes for tokens.

### Format
```json
{
  "installed": {
    "client_id": "123456789-abcdef.apps.googleusercontent.com",
    "client_secret": "GOCSPX-...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "redirect_uris": ["http://localhost"]
  }
}
```
Or for web apps: `"web": { ... }` with specific redirect_uris.

### How obtained
- Downloaded from GCP Console (APIs & Services > Credentials)
- Found in: source code, config files, client-side JavaScript (for web apps), mobile app decompilation
- Common filename: `client_secret_*.json` or `credentials.json`

### What it grants access to (alone)
**Nothing.** Client credentials alone cannot access any user data. They must be combined with a user's authorization (consent flow) or a refresh token.

### Red team value: MEDIUM
While they don't directly grant data access, client credentials are valuable for:

1. **Consent phishing**: Create a fake OAuth consent screen using the stolen client_id. If the app is "Internal" (Workspace org), any user in the org can authorize it without admin approval. The attacker gets a refresh token for each user who clicks "Allow."

2. **App identity theft**: If the original app has high trust (admin-approved, domain-wide install), a consent screen using its client_id inherits that trust visually.

3. **Scope expansion**: If you have a refresh token but need more scopes, having the matching client_id + secret lets you initiate a new consent flow requesting additional scopes.

4. **Token introspection**: With client_id + secret, you can call the token revocation and tokeninfo endpoints.

### Implementation complexity: LOW for ingestion, but the attack value is in consent phishing which requires hosting an OAuth callback endpoint.

### Ninken implementation plan
- Auto-detect `client_secret_*.json` format (nested under `"installed"` or `"web"` key)
- Store as a "tool" credential — not directly usable for data access
- Pair with captured refresh tokens (match by client_id)
- Future: host an OAuth callback endpoint for consent phishing campaigns

### Caveats
- Client secrets for "Desktop" apps are not really secret (Google acknowledges this)
- Web app client secrets are more sensitive (specific redirect URIs)
- "Internal" org apps bypass the unverified app warning screen
- Client credentials grant (client_credentials) is NOT supported by Google's OAuth — always requires user authorization

---

## 8. Google Workspace Marketplace Tokens

### What it is
When a Workspace admin installs a Marketplace app for the entire organization, the app gets a service account with domain-wide delegation to all users, scoped to the permissions the admin approved.

### How it works
- Marketplace apps register their required OAuth scopes
- Admin installs the app from the Marketplace (or G Suite admin console)
- The app's service account gets automatic DWD for approved scopes
- The app can then access all users' data without individual consent

### How credentials are obtained (red team)
- Compromise the Marketplace app's backend/infrastructure
- Find the app's service account key in their source code or CI/CD
- If you're the app developer: you already have the SA key
- Supply chain attack: compromise a popular Marketplace app's build pipeline

### Red team value: HIGH
- Marketplace apps often have broad scopes (Gmail read, Drive read, Calendar, etc.)
- DWD access to all users — same power as Section 3
- Users and admins often forget about installed Marketplace apps
- App permissions are rarely audited

### Implementation complexity: MEDIUM
From Ninken's perspective, a Marketplace app's SA key is just a service account key with DWD (Section 2 + Section 3). No special handling needed.

### Additional audit value
Ninken's Audit mode should enumerate installed Marketplace apps:
- `admin.directory.domain.readonly` scope lets you see authorized apps
- The Reports API shows app authorization events
- `GET https://admin.googleapis.com/admin/directory/v1/users/{userKey}/tokens` lists OAuth tokens granted to third-party apps

### Caveats
- Marketplace app credentials are only valuable if the app has DWD
- Some Marketplace apps use user-level OAuth consent instead of DWD
- Google is increasingly restricting DWD scope for Marketplace apps

---

## 9. SAML / OIDC Federation Tokens

### 9.1 Google as Identity Provider (IdP)

**What it is:** Google Workspace can act as a SAML/OIDC IdP for third-party applications. When a user logs in to a third-party app via "Sign in with Google" (Workspace SSO), Google issues a SAML assertion or OIDC ID token.

**Red team relevance:**
- If you have a user's Google session, you can access all federated applications
- SAML assertions can be forged if you obtain the IdP signing key (compromise Google's SA key used for SAML signing)
- OIDC tokens from Google SSO reveal which third-party apps the org uses

**Implementation complexity:** HIGH — SAML assertion replay is complex. More relevant as an attack vector than as a Ninken feature.

### 9.2 Google as Service Provider (SP)

**What it is:** Google Workspace can accept SAML assertions from an external IdP (e.g., Okta, Azure AD, PingFederate) for user authentication.

**Red team relevance:**
- If the external IdP is compromised, forged SAML assertions grant access to Google Workspace
- "Golden SAML" attacks: if you have the IdP's signing certificate, you can forge assertions for any user
- Google trusts the assertion — no Google password needed

**Implementation complexity:** N/A for Ninken directly. Golden SAML attacks produce access to Google, which then gives you OAuth tokens usable in Ninken.

### 9.3 Google Cloud Workload Identity Federation (OIDC/SAML)

Covered in Section 5.4. External OIDC/SAML tokens exchanged for GCP access tokens.

### Red team value: MEDIUM-HIGH overall
SAML/OIDC tokens are more about the attack chain to GET Google access than something Ninken would directly ingest. However, Ninken's audit mode should detect:
- Whether the org uses SSO (external IdP)
- Which IdP is configured (SAML entity ID)
- SSO bypass configuration (which users can use passwords vs. must use SSO)

---

## 10. Stolen / Harvested Token Types

These are credentials obtained through compromise rather than through legitimate OAuth flows.

### 10.1 Browser Cookie Session Tokens

**What it is:** Google's session cookies (`SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `NID`, `__Secure-1PSID`, `__Secure-3PSID`, etc.) maintain an authenticated browser session.

**How obtained:**
- Browser cookie theft (malware, XSS, physical access)
- Cookie databases: `~/Library/Application Support/Google/Chrome/Default/Cookies` (encrypted on newer Chrome)
- Memory dump of browser process
- Network interception (though these cookies are Secure/HttpOnly)

**What they grant access to:**
- Full web UI access to all Google services (equivalent to being logged into the browser)
- Can be used to initiate OAuth consent flows (get refresh tokens for any scope)
- Access to Google Admin Console if the user is an admin
- Access to GCP Console

**Red team value:** CRITICAL
- Full persistent access until the user explicitly signs out or the session expires
- Can be used from any browser (import cookies, access Google web UI)
- Multi-service access from a single session
- Can be used to generate OAuth tokens for programmatic access

**Implementation complexity:** HIGH
- Ninken would need to use cookies to make requests to Google's web endpoints (not standard API)
- Google's web endpoints are not designed for programmatic access (HTML parsing, CSRF tokens)
- Better approach: use the session cookies to initiate an OAuth consent flow and extract a refresh token
- Cookie format varies across browsers and OS versions
- Cookie encryption (Chrome on macOS uses Keychain, Windows uses DPAPI)

**Ninken implementation plan:**
- Accept cookie import (JSON format from browser extensions like EditThisCookie)
- Use cookies to call `https://accounts.google.com/o/oauth2/auth` and extract an authorization code
- Exchange the code for a refresh token using a known client_id
- Then proceed with standard Ninken OAuth flow
- This effectively converts a session cookie into a refresh token

### 10.2 gcloud CLI Cached Credentials

**What it is:** The `gcloud` CLI stores credentials in several locations:

| File | Contents | Red Team Value |
|------|----------|----------------|
| `~/.config/gcloud/credentials.db` | SQLite DB with all authorized accounts' refresh tokens | CRITICAL |
| `~/.config/gcloud/application_default_credentials.json` | ADC credentials (Section 6) | HIGH |
| `~/.config/gcloud/properties` | Active project, account, region config | MEDIUM |
| `~/.config/gcloud/access_tokens.db` | Cached access tokens (short-lived) | MEDIUM |
| `~/.config/gcloud/legacy_credentials/` | Per-account JSON files with refresh tokens | HIGH |
| `~/.config/gcloud/configurations/` | Named config profiles | LOW |

**How obtained:**
- File theft from developer/ops workstations
- SSH access to servers where gcloud is configured
- Container/VM image analysis
- Backup file access
- Memory dump

**credentials.db structure:**
SQLite database with table `credentials`:
```
account_id TEXT PRIMARY KEY,
value BLOB  -- JSON containing refresh_token, client_id, client_secret
```

The client_id/secret are gcloud's own OAuth client (well-known, public):
- Client ID: `32555940559.apps.googleusercontent.com`
- Client Secret: `ZmssLNjJy2998hD4CTg2ejr2`

**Red team value:** CRITICAL
- Most developers and ops engineers have gcloud installed
- The credentials.db file contains refresh tokens for ALL authorized accounts
- Often contains multiple accounts (personal + work)
- gcloud credentials typically have `cloud-platform` scope (full GCP access)
- The refresh tokens are long-lived and rarely rotated

**Implementation complexity:** LOW
- Auto-detection: If the pasted JSON has gcloud's client_id/secret, it's a gcloud credential
- The refresh token works exactly like any other Google OAuth refresh token
- Ninken already handles this format
- Could add SQLite parsing for direct `credentials.db` import

**Ninken implementation plan:**
- Add "Import gcloud credentials" option that accepts the SQLite file or individual credential JSON
- Parse and extract all accounts
- Each becomes a separate Ninken profile
- Note: gcloud tokens typically only have `cloud-platform` scope, not Workspace scopes

### 10.3 Application-Specific Passwords (ASPs)

**What it is:** Legacy app passwords that bypass 2FA. Generated in Google Account settings for apps that don't support OAuth (e.g., older email clients using IMAP/SMTP).

**Format:** 16-character lowercase string, typically displayed as `xxxx xxxx xxxx xxxx`

**How obtained:**
- Credential dumps, password manager exports
- Post-exploitation on machines running mail clients
- Phishing (less common for ASPs)

**What they grant access to:**
- IMAP/SMTP access (email read/send)
- CalDAV (calendar)
- CardDAV (contacts)
- XMPP (legacy Google Talk)
- Basically: any protocol-based access that uses username + password

**Red team value:** MEDIUM
- Limited to protocol-level access (no Drive, no Admin SDK, no GCP)
- Can be used for email access without triggering 2FA
- IMAP access allows full mailbox download
- SMTP access allows sending email as the user
- Cannot be used with Google's REST APIs

**Implementation complexity:** MEDIUM
- Ninken would need IMAP/SMTP client libraries
- Could implement: IMAP mailbox browsing, email download, email sending
- This is a completely different access pattern than the OAuth REST API approach
- Libraries: `imapflow` (Node.js IMAP), `nodemailer` (SMTP)

**Ninken implementation plan:**
- New credential type: `{ type: "asp", email: "user@domain.com", password: "xxxx xxxx xxxx xxxx" }`
- IMAP-based Gmail access (different from the current Gmail API approach)
- Lower fidelity than API access (no labels API, no thread grouping, etc.)
- Useful as a fallback when OAuth tokens aren't available

### 10.4 Backup/Verification Codes

**What it is:** One-time-use codes generated by Google as a 2FA backup. Typically 8 digits, user gets 10 of them.

**How obtained:**
- Physical access to a printed backup codes sheet (common in offices)
- Credential dumps
- Account recovery attacks

**What they grant access to:**
- Bypass 2FA during login (one-time use per code)
- Combined with the user's password: full account access via browser login
- From there: can generate OAuth tokens for any scope

**Red team value:** MEDIUM
- Only useful combined with the user's password
- One-time use (once used, the code is burned)
- User may notice if they try to use a code that's already been used
- Better used as a "break glass" backup than as a primary access method

**Implementation complexity:** N/A for Ninken directly. These are used to gain initial browser access, after which the attacker can generate OAuth tokens or session cookies that Ninken can ingest.

### 10.5 OAuth Authorization Codes

**What it is:** Short-lived codes (typically valid for a few minutes) that appear in URL redirect parameters during the OAuth consent flow. They can be exchanged exactly once for an access token + refresh token.

**Format:** `4/0A...` (appears in `?code=` parameter of the redirect URL)

**How obtained:**
- Intercepting OAuth redirects (network sniffing, malicious redirect_uri, open redirector)
- Referrer header leaking
- Browser history

**Red team value:** LOW-MEDIUM
- Very short-lived (minutes)
- Can only be used once
- Requires the matching client_id + client_secret to exchange
- If successfully exchanged, produces a full refresh_token (high value)

**Implementation complexity:** LOW — Ninken could offer a "code exchange" tool: paste the auth code + client_id + client_secret, exchange it for tokens.

### 10.6 Primary Refresh Token (PRT) — Google Context

**What it is:** While PRT is primarily a Microsoft concept (used in Azure AD for device SSO), Google has an analogous concept in Chrome OS and Android called the "LSID" (Login Service ID) and "SID" tokens, plus the OAuth multilogin cookie.

On ChromeOS/Android, the device-level Google account has a master token that generates all other tokens. If this token is extracted, it provides access equivalent to full account access.

**How obtained:**
- ChromeOS device exploitation (local storage)
- Android device rooting + token extraction
- `AccountManager` tokens on Android (`/data/system/users/0/accounts.db`)

**Red team value:** CRITICAL on mobile/ChromeOS, not applicable on desktop

**Implementation complexity:** HIGH — requires platform-specific extraction, then the token can be used like any other refresh token.

---

## 11. Implementation Priority Matrix

Based on red team value, implementation complexity, and frequency of encounter in real-world engagements:

### Tier 1 — Implement Next (High Value, Achievable Complexity)

| Token/Feature | Value | Complexity | Rationale |
|--------------|-------|------------|-----------|
| **Service Account Keys** | CRITICAL | MEDIUM | Most commonly leaked GCP credential. JWT signing in Node.js is straightforward. |
| **Domain-Wide Delegation** | CRITICAL | MEDIUM | Builds on SA keys. The most powerful Workspace access vector. |
| **Admin Reports API** (new scopes on existing OAuth) | CRITICAL | LOW | Same auth flow, just new API calls. OPSEC intelligence goldmine. |
| **Google Vault API** | CRITICAL | MEDIUM | Mass data exfiltration. New API client but standard OAuth. |
| **Alert Center API** | CRITICAL | LOW | OPSEC: see if your activity has triggered alerts. |
| **gcloud credential import** | HIGH | LOW | Parse credentials.db SQLite, extract refresh tokens. Very common find. |
| **Raw access token ingestion** | HIGH | LOW | Accept `ya29.*` tokens with expiry countdown. Quick wins during active ops. |

### Tier 2 — High Value, Moderate Effort

| Token/Feature | Value | Complexity | Rationale |
|--------------|-------|------------|-----------|
| **Google Chat API** | HIGH | LOW | Internal comms often contain credentials and sensitive decisions. |
| **Cloud IAM enumeration** | CRITICAL | MEDIUM | Full permission mapping for GCP projects. |
| **Cloud Logging API** | HIGH | MEDIUM | OPSEC: check if your activity is logged and monitored. |
| **People/Contacts API** | MEDIUM-HIGH | LOW | Network mapping, "other contacts" reveals communication patterns. |
| **Drive Activity API** | HIGH | LOW | File access audit trail. |
| **Groups Settings API** | HIGH | LOW | Find externally joinable groups. |
| **DLP rule enumeration** | HIGH | MEDIUM | OPSEC: understand what exfiltration patterns trigger alerts. |
| **Chrome Management API** | HIGH | MEDIUM | Endpoint security posture. |

### Tier 3 — Specialized / Lower Frequency

| Token/Feature | Value | Complexity | Rationale |
|--------------|-------|------------|-----------|
| **Application-Specific Passwords** | MEDIUM | MEDIUM | IMAP/SMTP is a different paradigm; less common in modern orgs. |
| **API Key probe tool** | LOW-MEDIUM | LOW | Limited value but low effort. Firebase exception is notable. |
| **OAuth client credential phishing** | MEDIUM | HIGH | Requires hosting infrastructure. |
| **Browser cookie -> token conversion** | CRITICAL | HIGH | Very powerful but complex browser cookie handling. |
| **Workload Identity Federation** | MEDIUM | HIGH | Niche: relevant for cloud-native attacks. |
| **GCE metadata token parsing** | HIGH | LOW | Just parse captured JSON; no special auth needed. |
| **SAML/OIDC token analysis** | MEDIUM | HIGH | More about attack chain than data browsing. |

### New Credential Types for `providers/types.ts`

```
GoogleServiceAccountCredential
  - type: "service_account"
  - project_id, private_key_id, private_key, client_email, client_id

GoogleADCCredential (authorized_user variant)
  - type: "authorized_user"
  - client_id, client_secret, refresh_token
  (functionally identical to current GoogleCredential)

GoogleAccessToken (raw, no refresh)
  - type: "access_token"
  - access_token, expires_at (optional)
  - one-shot, no refresh capability

GoogleASPCredential
  - type: "app_specific_password"
  - email, password
  - IMAP/SMTP only

GoogleAPIKey
  - type: "api_key"
  - key: string
  - probe-only, no user data access
```

### New `scopeAppMap` Entries for Google Provider

```typescript
scopeAppMap: {
  // ... existing entries ...
  chat: [
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/chat.memberships.readonly",
  ],
  vault: [
    "https://www.googleapis.com/auth/ediscovery.readonly",
    "https://www.googleapis.com/auth/ediscovery",
  ],
  reports: [
    "https://www.googleapis.com/auth/admin.reports.audit.readonly",
    "https://www.googleapis.com/auth/admin.reports.usage.readonly",
  ],
  alertcenter: [
    "https://www.googleapis.com/auth/apps.alerts",
  ],
  contacts: [
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/contacts.other.readonly",
    "https://www.googleapis.com/auth/directory.readonly",
  ],
  iam: [
    "https://www.googleapis.com/auth/iam",
    "https://www.googleapis.com/auth/cloud-platform",
  ],
  logging: [
    "https://www.googleapis.com/auth/logging.read",
  ],
  secretmanager: [
    "https://www.googleapis.com/auth/cloud-platform",
  ],
  compute: [
    "https://www.googleapis.com/auth/compute.readonly",
  ],
  bigquery: [
    "https://www.googleapis.com/auth/bigquery.readonly",
    "https://www.googleapis.com/auth/bigquery",
  ],
  chromemanagement: [
    "https://www.googleapis.com/auth/chrome.management.policy.readonly",
    "https://www.googleapis.com/auth/chrome.management.reports.readonly",
  ],
  driveactivity: [
    "https://www.googleapis.com/auth/drive.activity.readonly",
  ],
  groupssettings: [
    "https://www.googleapis.com/auth/apps.groups.settings",
  ],
}
```

### New `operateNavItems` for Google Provider

```typescript
operateNavItems: [
  // ... existing ...
  { id: "chat", title: "Chat", href: "/chat", iconName: "MessageCircle" },
  { id: "contacts", title: "Contacts", href: "/contacts", iconName: "Contact" },
]
```

### New `auditNavItems` for Google Provider

```typescript
auditNavItems: [
  // ... existing ...
  { id: "audit-reports", title: "Activity Logs", href: "/audit/reports", iconName: "ScrollText" },
  { id: "audit-alerts", title: "Alert Center", href: "/audit/alerts", iconName: "AlertTriangle" },
  { id: "audit-vault", title: "Vault", href: "/audit/vault", iconName: "Lock" },
  { id: "audit-iam", title: "Cloud IAM", href: "/audit/iam", iconName: "Key" },
  { id: "audit-dlp", title: "DLP Rules", href: "/audit/dlp", iconName: "Shield" },
  { id: "audit-chrome", title: "Chrome Mgmt", href: "/audit/chrome", iconName: "Globe" },
]
```

---

## Appendix A: Complete Google OAuth2 Scope Reference (Red Team Relevant)

Below is every scope that could be valuable for red team operations, organized by API:

### Gmail
```
https://mail.google.com/                                    Full access (read, send, delete, manage)
https://www.googleapis.com/auth/gmail.readonly               Read-only
https://www.googleapis.com/auth/gmail.modify                 Read + modify (labels, trash)
https://www.googleapis.com/auth/gmail.compose                Create drafts + send
https://www.googleapis.com/auth/gmail.send                   Send only
https://www.googleapis.com/auth/gmail.insert                 Insert messages into mailbox
https://www.googleapis.com/auth/gmail.labels                 Manage labels
https://www.googleapis.com/auth/gmail.settings.basic         Read settings (filters, forwarding)
https://www.googleapis.com/auth/gmail.settings.sharing       Manage delegates
```

### Drive
```
https://www.googleapis.com/auth/drive                        Full access
https://www.googleapis.com/auth/drive.readonly               Read-only
https://www.googleapis.com/auth/drive.file                   Per-file access (app-created files only)
https://www.googleapis.com/auth/drive.appdata                App data folder
https://www.googleapis.com/auth/drive.metadata.readonly      Metadata only
https://www.googleapis.com/auth/drive.activity.readonly      Drive activity feed
```

### Calendar
```
https://www.googleapis.com/auth/calendar                     Full access
https://www.googleapis.com/auth/calendar.readonly            Read-only
https://www.googleapis.com/auth/calendar.events              Events read/write
https://www.googleapis.com/auth/calendar.events.readonly     Events read-only
https://www.googleapis.com/auth/calendar.settings.readonly   Settings read-only
```

### Admin SDK
```
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.group.readonly
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.orgunit.readonly
https://www.googleapis.com/auth/admin.directory.domain.readonly
https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly
https://www.googleapis.com/auth/admin.directory.rolemanagement
https://www.googleapis.com/auth/admin.directory.device.mobile.readonly
https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly
https://www.googleapis.com/auth/admin.directory.customer.readonly
https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly
https://www.googleapis.com/auth/admin.directory.userschema.readonly
https://www.googleapis.com/auth/admin.reports.audit.readonly
https://www.googleapis.com/auth/admin.reports.usage.readonly
```

### Google Chat
```
https://www.googleapis.com/auth/chat.spaces.readonly
https://www.googleapis.com/auth/chat.spaces
https://www.googleapis.com/auth/chat.messages.readonly
https://www.googleapis.com/auth/chat.messages
https://www.googleapis.com/auth/chat.messages.create
https://www.googleapis.com/auth/chat.memberships.readonly
https://www.googleapis.com/auth/chat.memberships
```

### Google Vault
```
https://www.googleapis.com/auth/ediscovery.readonly
https://www.googleapis.com/auth/ediscovery
```

### Alert Center
```
https://www.googleapis.com/auth/apps.alerts
```

### People / Contacts
```
https://www.googleapis.com/auth/contacts.readonly
https://www.googleapis.com/auth/contacts
https://www.googleapis.com/auth/contacts.other.readonly
https://www.googleapis.com/auth/directory.readonly
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

### Cloud Platform (GCP)
```
https://www.googleapis.com/auth/cloud-platform                Full GCP access
https://www.googleapis.com/auth/cloud-platform.read-only       Read-only GCP
https://www.googleapis.com/auth/iam                            IAM management
https://www.googleapis.com/auth/logging.read                   Read logs
https://www.googleapis.com/auth/logging.write                  Write logs
https://www.googleapis.com/auth/monitoring.read                Read metrics
https://www.googleapis.com/auth/compute.readonly               Compute Engine read
https://www.googleapis.com/auth/devstorage.full_control        Cloud Storage full
https://www.googleapis.com/auth/devstorage.read_only           Cloud Storage read
https://www.googleapis.com/auth/bigquery                       BigQuery full
https://www.googleapis.com/auth/bigquery.readonly              BigQuery read
https://www.googleapis.com/auth/sqlservice.admin               Cloud SQL admin
https://www.googleapis.com/auth/cloudkms                       Cloud KMS
https://www.googleapis.com/auth/pubsub                         Pub/Sub
https://www.googleapis.com/auth/datastore                      Datastore/Firestore
https://www.googleapis.com/auth/firebase                       Firebase
https://www.googleapis.com/auth/service.management.readonly    Service Management read
https://www.googleapis.com/auth/cloudfunctions                 Cloud Functions
```

### Groups Settings
```
https://www.googleapis.com/auth/apps.groups.settings
```

### Chrome Management
```
https://www.googleapis.com/auth/chrome.management.policy.readonly
https://www.googleapis.com/auth/chrome.management.reports.readonly
https://www.googleapis.com/auth/chrome.management.telemetry.readonly
```

---

## Appendix B: Token Harvesting Locations Cheat Sheet

Where to find Google tokens on compromised systems:

### macOS
```
~/.config/gcloud/credentials.db                     gcloud refresh tokens (SQLite)
~/.config/gcloud/application_default_credentials.json  ADC
~/.config/gcloud/legacy_credentials/*/adc.json       Legacy per-account credentials
~/Library/Application Support/Google/Chrome/Default/Cookies  Chrome session cookies (encrypted)
~/Library/Application Support/Google/Chrome/Default/Login Data  Saved passwords (encrypted)
~/Library/Application Support/Google/Chrome/Profile */Cookies   Additional Chrome profiles
~/Library/Keychains/login.keychain-db                Chrome cookie encryption key
~/.config/gcloud/properties                          Active project/account config
```

### Linux
```
~/.config/gcloud/credentials.db
~/.config/gcloud/application_default_credentials.json
~/.config/google-chrome/Default/Cookies              Chrome cookies (encrypted with DPAPI or gnome-keyring)
~/.config/google-chrome/Default/Login Data           Saved passwords
/tmp/gcloud-*/                                       Temporary gcloud files
$GOOGLE_APPLICATION_CREDENTIALS                      Environment variable path
/var/run/secrets/google/                             Kubernetes workload identity
```

### Windows
```
%APPDATA%\gcloud\credentials.db
%APPDATA%\gcloud\application_default_credentials.json
%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies    Chrome cookies (DPAPI encrypted)
%LOCALAPPDATA%\Google\Chrome\User Data\Default\Login Data  Saved passwords (DPAPI)
```

### CI/CD & Cloud
```
/var/run/secrets/kubernetes.io/serviceaccount/token   GKE pod SA token
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token  GCE metadata
$GOOGLE_APPLICATION_CREDENTIALS                       CI/CD service account key path
$GCLOUD_SERVICE_KEY                                   Common CI variable name
$GCP_SA_KEY                                          Common CI variable name
.github/workflows/*.yml                              GitHub Actions secrets references
.circleci/config.yml                                 CircleCI env references
Jenkinsfile                                          Jenkins credential references
terraform.tfstate                                    Terraform state (may contain SA keys)
.env, .env.local, .env.production                   Environment files
```

### Mobile / ChromeOS
```
/data/system/users/0/accounts.db                     Android account tokens (root)
/data/data/com.google.android.gms/databases/         Google Play Services tokens
/home/chronos/.config/google-chrome/                 ChromeOS Chrome data
```

---

## Appendix C: Detection & OPSEC Considerations

### What Google logs per token type

| Token Type | Logged Where | Log Detail Level |
|------------|-------------|------------------|
| OAuth user token (API calls) | Admin Reports API, Cloud Audit Logs | API name, user email, timestamp, IP |
| Service account (API calls) | Cloud Audit Logs | SA email, API name, timestamp, IP |
| DWD impersonation | Admin Reports API | SA email + impersonated user, API name |
| API key (API calls) | Cloud Audit Logs | Project ID, API name, IP |
| gcloud CLI | Admin Reports, Cloud Audit Logs | Same as OAuth user token |
| App-specific password (IMAP) | Admin Reports (Login activity) | IP, protocol, timestamp |
| Browser session (web UI) | Admin Reports (Login activity) | IP, browser, device, location |

### OPSEC recommendations for Ninken operators
1. **Rate limit API calls** — burst activity triggers anomaly detection
2. **Match the user's normal patterns** — if the user logs in from Toronto, don't call APIs from Singapore
3. **Prefer read-only scopes** — read operations are less likely to trigger alerts than modifications
4. **Avoid Admin SDK** unless the token owner is actually an admin — permission denied errors are logged
5. **Check Alert Center first** — see if your activity has already been detected before going deeper
6. **Monitor token expiry** — a suddenly revoked refresh token means you've been detected
7. **Use Vault exports sparingly** — large exports are conspicuous and take time

---

*End of research document. This document is for authorized security testing and red team operations only.*
