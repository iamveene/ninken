# Token Expansion Roadmap — Unified Brainstorm

**Date:** 2026-03-19
**Status:** Brainstorm / Research — no implementation decisions finalized
**Companion docs:** [Google Token Research](../../GOOGLE-TOKEN-RESEARCH.md) | [Microsoft Token Landscape](./microsoft-token-landscape.md)

---

## Executive Summary

Ninken currently supports two credential types:
- **Google:** OAuth2 refresh token (user-delegated) → Gmail, Drive, Calendar, GCS, Admin Directory
- **Microsoft:** FOCI refresh token (user-delegated via Teams client ID) → Outlook, OneDrive, Teams, Entra ID, Audit Logs

This document maps **every meaningful token type and API surface** we could add, organized into a unified priority matrix with architecture impact analysis.

---

## Part 1: The Big Wins (Low Effort, Massive Value)

These require minimal architecture changes — mostly new API calls on existing credentials.

### 1.1 Microsoft Resource Pivot Probing

**The insight:** A single Microsoft refresh token can be exchanged for access tokens to 20+ different resource audiences by changing the `scope` parameter. Ninken currently only targets `graph.microsoft.com`. Same token, different scope = Azure infrastructure access.

**Resources unlockable from existing refresh tokens:**
| Resource | Scope | What it reveals |
|----------|-------|-----------------|
| Azure Resource Manager | `management.azure.com/.default` | Subscriptions, VMs, storage, networking |
| Azure Key Vault | `vault.azure.net/.default` | Secrets, certificates, encryption keys |
| Azure Storage | `storage.azure.com/.default` | Blobs, file shares, tables |
| Azure SQL | `database.windows.net/.default` | Database access |
| Azure DevOps | `dev.azure.com/.default` | Repos, pipelines, secrets |
| Power BI | `analysis.windows.net/powerbi/api` | BI reports, datasets |
| Log Analytics | `api.loganalytics.io/.default` | Query security logs |
| Power Apps/Automate | `service.powerapps.com/.default` | Low-code apps, automation flows |

**Effort:** LOW — just iterate scopes in the existing token refresh call
**Architecture impact:** Add per-resource token cache in `microsoft.ts`, add resource accessibility map to `MicrosoftCredential`

### 1.2 Microsoft FOCI Client ID Pivoting

**The insight:** Ninken uses the Teams FOCI client ID. The same refresh token works with Azure CLI's client ID, which unlocks ARM access that Teams' client ID may not get.

**Known FOCI client IDs to try:**
| Client ID | App | Typical extra access |
|-----------|-----|---------------------|
| `04b07795-ee44-4dc3-a537-67c46da089de` | Azure CLI | ARM, Key Vault, DevOps |
| `1950a258-227b-4e31-a9cf-717495945fc2` | Azure PowerShell | ARM, Key Vault |
| `d3590ed6-52b3-4102-aeff-aad2292ab01c` | Microsoft Office | SharePoint direct |
| `00b41c95-dab0-4487-9791-b9d2c32c80f2` | O365 Management | Audit/Activity logs |
| `ab9b8c07-8f02-4f72-87fa-80105867a763` | OneDrive Sync | OneDrive direct |
| `d326c1ce-6cc6-4de2-bebc-4591e5e13ef0` | SharePoint | SharePoint direct |

**Effort:** LOW — loop over FOCI client IDs × resource scopes on import
**Deliverable:** "Capability Matrix" shown after credential import — what this token can reach

### 1.3 Google Additional Scopes on Existing Tokens

Ninken's existing Google OAuth tokens may already have scopes we're not using. These require only new API routes — no auth changes:

| API | What it reveals | Red Team Value |
|-----|-----------------|---------------|
| Admin Reports API | All admin actions, login events, token grants, file sharing | CRITICAL (OPSEC) |
| Alert Center API | Active security alerts — see if you've been detected | CRITICAL (OPSEC) |
| Google Chat API | Internal chat messages, shared credentials, decisions | HIGH |
| Drive Activity API | Who accessed what file, when, permission changes | HIGH |
| People/Contacts API | "Other contacts" — auto-saved from email interactions | HIGH |
| Groups Settings API | Which groups allow external members/posting | HIGH |
| Cloud Logging API | GCP audit logs — check if your activity is monitored | HIGH |

**Effort:** LOW per API — same `google.admin()` / `googleapis` client, new endpoints
**Limitation:** These only work if the ingested token was granted the relevant scopes

### 1.4 Microsoft Conditional Access Policy Reading

**Why this is critical:** CA policies ARE the M365 security perimeter. Reading them tells you:
- Trusted IPs/countries (where to route your C2)
- Which apps skip MFA (attack targets)
- Legacy auth allowances (password spray targets)
- Break-glass accounts and excluded groups

**Scope needed:** `Policy.Read.All` (admin consent required)
**Effort:** LOW — simple JSON display, well-structured data
**Deliverable:** CA Policy viewer in Audit mode

### 1.5 Microsoft Authentication Methods Enumeration

Shows which users have MFA, what type (SMS, Authenticator, FIDO2), and coverage gaps.

**Scope needed:** `UserAuthenticationMethod.Read.All`
**Effort:** LOW — extend Entra ID user detail view

---

## Part 2: New Credential Types

These require changes to the provider abstraction and credential detection.

### 2.1 Google Service Account Keys (JWT)

**What:** JSON key files with a private key. The most commonly leaked GCP credential. Never expire by default.

**Credential shape:**
```
{
  "type": "service_account",
  "project_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "sa@project.iam.gserviceaccount.com",
  ...
}
```

**Auth flow:** Sign JWT with private key → POST to Google token endpoint → get access token (1hr, no refresh token — re-sign JWT each time)

**Architecture impact:**
- New credential type in `providers/types.ts`: `GoogleServiceAccountCredential`
- Detection: `"type" === "service_account"` && `"private_key"` present
- JWT signing: `jsonwebtoken` npm or Web Crypto API (RS256)
- Scope selector UI needed (SA tokens require explicit scope requests)
- No refresh token dance — stateless re-authentication each hour

**Red team value:** CRITICAL — found in git repos, CI/CD, terraform state, env vars
**Effort:** MEDIUM
**Limitation:** SA keys can't access Workspace APIs unless domain-wide delegation is configured

### 2.2 Google Domain-Wide Delegation (DWD)

**What:** A service account that can impersonate ANY user in the Google Workspace domain. Read every mailbox, every Drive, every Calendar. The impersonated user gets no notification.

**Auth flow:** Same as SA key, but JWT includes `"sub": "target-user@domain.com"` field. The resulting access token acts as that user.

**Architecture impact:**
- Builds on top of SA key support (2.1)
- "Impersonation panel" UI: target email input, scope selector
- Combine with Admin Directory listing for target picker
- "Currently impersonating: user@domain.com" banner
- Batch operations: "Pull all mailboxes", "Search all Drives"

**Red team value:** CRITICAL — single most powerful Google Workspace access vector
**Effort:** MEDIUM (on top of SA key support)
**Limitation:** Only works if admin pre-approved the SA for DWD + specific scopes

### 2.3 Microsoft Service Principal (Client Credentials)

**What:** `client_id` + `client_secret` + `tenant_id`. App-only authentication. No user context — the app acts as itself with APPLICATION permissions.

**Auth flow:** `POST /token` with `grant_type=client_credentials` — no refresh token needed, stateless

**Key difference from current model:**
- App-only tokens with `Mail.Read` can read ALL mailboxes (not just one user's)
- Can't use `/me/` endpoints — must use `/users/{user-id}/`
- Token has `roles` claim instead of `scp`
- Bypasses user-level CA policies

**Architecture impact:**
- New credential sub-type or new provider `microsoft-sp`
- Client credentials flow in `microsoft.ts`
- User picker UI (no `/me/` — operator chooses target)
- Different scope display (roles vs scp)

**Red team value:** CRITICAL — SP secrets found in source code, CI/CD, env vars
**Effort:** MEDIUM

### 2.4 Raw Access Tokens (Both Providers)

**What:** Short-lived bearer tokens pasted directly — no refresh capability. From `gcloud auth print-access-token`, SSRF-captured metadata tokens, intercepted API calls, etc.

**Architecture impact:**
- New credential type: `{ type: "access_token", token: "ya29.*" | "eyJ0...", provider: "google" | "microsoft" }`
- Auto-detect provider from token format (Google: `ya29.`, Microsoft: JWT with `iss: sts.windows.net`)
- Probe with `tokeninfo` (Google) or JWT decode (Microsoft) to discover scopes/expiry
- Prominent countdown timer — token is dying
- No refresh — when it expires, it's dead

**Red team value:** HIGH — quick use during active ops, SSRF captures
**Effort:** LOW

### 2.5 Azure CLI / PowerShell Cache Import

**What:** `~/.azure/msal_token_cache.json` contains plaintext refresh tokens for all `az login` sessions. Azure CLI client ID is FOCI, so these tokens pivot to everything.

**Architecture impact:**
- New format detection in `normalizeRaw` / `detectCredential`
- Parse MSAL cache JSON structure → extract refresh tokens
- Each account becomes a separate Ninken profile
- Auto-detect Azure CLI (`04b07795-...`) and PowerShell (`1950a258-...`) client IDs

**Red team value:** CRITICAL — most commonly harvested token on developer workstations
**Effort:** LOW

### 2.6 gcloud CLI Credential Import

**What:** `~/.config/gcloud/credentials.db` (SQLite) or `application_default_credentials.json` contain Google refresh tokens.

**Architecture impact:**
- ADC `authorized_user` format already works with current ingestion (same fields)
- Add explicit `"type": "authorized_user"` detection for cleaner UX
- SQLite import would be a nice-to-have (parse `credentials.db`)
- gcloud uses well-known client_id: `32555940559.apps.googleusercontent.com`

**Red team value:** HIGH — very common on developer machines
**Effort:** LOW (JSON) / MEDIUM (SQLite)
**Limitation:** gcloud tokens typically only have `cloud-platform` scope, not Workspace scopes

### 2.7 Microsoft Certificate-Based SP Auth

**What:** Service principal with X.509 certificate instead of client secret. Private key signs a JWT assertion.

**Architecture impact:**
- Accept PFX/PEM upload
- JWT assertion signing (Web Crypto API)
- Same client_credentials flow, `client_assertion` instead of `client_secret`

**Red team value:** HIGH
**Effort:** MEDIUM-HIGH

### 2.8 Azure DevOps PATs

**What:** Personal Access Tokens for dev.azure.com. Long-lived, scoped to an organization.

**Architecture impact:**
- New provider entirely (`azure-devops`) — different base URL, auth scheme, API structure
- Auth: `Authorization: Basic base64(:pat)`
- Modules: Repo browser, pipeline viewer, variable groups (secrets), service connections

**Red team value:** CRITICAL — source code, CI/CD secrets, deployment infrastructure
**Effort:** MEDIUM (new provider)

---

## Part 3: High-Value API Surfaces (New Modules)

### 3.1 Microsoft ARM Module (Azure Infrastructure)

**Priority modules within ARM:**
1. Subscription + resource group enumeration
2. Key Vault secrets listing (names + metadata)
3. Storage account enumeration + blob listing
4. VM inventory (OS, IPs, status, run commands)
5. App Service / Function App configuration (connection strings!)
6. Network topology (VNets, NSGs, public IPs)
7. SQL database enumeration

**Effort:** HIGH (ARM API is huge, each resource type has its own API version)
**Architecture:** New route group, new token type (management.azure.com scope), reuse `graphFetch` pattern for `armFetch`

### 3.2 Microsoft Security API

"See what the SOC sees."
- Defender alerts across all products
- Security incidents (correlated)
- Secure score (what controls are disabled)
- Advanced hunting (KQL query editor) — query the same telemetry the blue team uses

**Effort:** MEDIUM-HIGH
**Red team value:** CRITICAL for OPSEC

### 3.3 Microsoft Compliance / eDiscovery

Built-in search-everything tool. Search across all mailboxes, SharePoint, OneDrive, and Teams simultaneously. Export results.

**Effort:** HIGH (async workflow, multi-step UI)
**Red team value:** HIGH — but requires E5 license in target tenant

### 3.4 Google Vault (eDiscovery equivalent)

Search any user's email/Drive by keyword across the entire org. Export complete mailboxes.

**Effort:** MEDIUM
**Red team value:** CRITICAL — requires Vault license + Vault admin privileges

### 3.5 Microsoft SharePoint Sites/Lists

Where orgs store policies, architecture diagrams, credential files, internal wikis.

**Effort:** MEDIUM (reuse file browser component with site picker)
**Red team value:** HIGH

### 3.6 Google Cloud IAM Enumeration

Full permission mapping for GCP projects:
- `testIamPermissions` reveals exact access level per project
- SA key listing reveals persistence mechanisms
- Role binding map shows entire permission structure

**Effort:** MEDIUM
**Red team value:** CRITICAL for GCP-heavy orgs

### 3.7 Microsoft PIM (Privileged Identity Management)

Who CAN become Global Admin (eligible roles) even if they aren't currently one. The escalation map.

**Effort:** MEDIUM
**Red team value:** CRITICAL

### 3.8 Microsoft Intune Device Inventory

Device fleet, OS versions, patch levels, compliance gaps, VPN configs, Wi-Fi PSKs, deployed security tools.

**Effort:** MEDIUM
**Red team value:** HIGH

---

## Part 4: Specialized / Long-Term

| Feature | Provider | Value | Effort | Notes |
|---------|----------|-------|--------|-------|
| PRT Cookie Import | Microsoft | CRITICAL | HIGH | Complex crypto, nonce management |
| Google Browser Cookie → Token | Google | CRITICAL | HIGH | Cookie handling, consent flow automation |
| Google App-Specific Passwords | Google | MEDIUM | MEDIUM | IMAP/SMTP — different paradigm entirely |
| Microsoft Device Code Flow | Microsoft | HIGH | LOW | Ethical/legal considerations — active phishing tool |
| Google API Key Probe | Google | LOW-MEDIUM | LOW | Firebase misconfiguration scanner |
| Microsoft OBO Flow | Microsoft | MEDIUM | MEDIUM | Niche: API-to-API lateral movement |
| Workload Identity Federation | Both | MEDIUM-HIGH | HIGH | Multi-step token exchange, external IdP |
| SAML/Golden SAML | Both | HIGH | HIGH | More about attack chain than data browsing |
| Microsoft Managed Identity | Microsoft | CRITICAL | LOW | Accept raw token — no refresh outside Azure |
| Azure AD Connect Sync Creds | Microsoft | CRITICAL | MEDIUM | ROPC flow with sync account |
| Google Workspace Marketplace Audit | Google | HIGH | MEDIUM | Enumerate installed apps + their DWD scopes |
| Microsoft Cross-Tenant Access | Microsoft | HIGH | LOW | B2B trust = lateral movement path |

---

## Part 5: Architecture Impact Summary

### New Credential Types Needed

```
Google:
  GoogleOAuthCredential          (existing — refresh_token + client_id + client_secret)
  GoogleServiceAccountCredential (NEW — private_key + client_email)
  GoogleAccessToken              (NEW — raw ya29.* with expiry countdown)
  GoogleADCCredential            (NEW-ish — authorized_user, maps to existing OAuth flow)
  GoogleASPCredential            (FUTURE — email + app-specific password, IMAP/SMTP)

Microsoft:
  MicrosoftCredential            (existing — FOCI refresh_token)
  MicrosoftSPCredential          (NEW — client_id + client_secret + tenant_id)
  MicrosoftCertCredential        (NEW — client_id + certificate + tenant_id)
  MicrosoftAccessToken           (NEW — raw JWT with expiry countdown)
  MicrosoftPRTCredential         (FUTURE — PRT cookie, complex crypto)
  AzureDevOpsPAT                 (NEW — PAT + organization, separate provider)
```

### Provider Registry Changes

Option A: Sub-types within existing providers
```
google.detectCredential → checks "type" field:
  "authorized_user" or missing → GoogleOAuthCredential (current flow)
  "service_account"            → GoogleServiceAccountCredential (JWT flow)
  raw "ya29.*" string          → GoogleAccessToken (probe-only)

microsoft.detectCredential → checks fields:
  refresh_token present        → MicrosoftCredential (current flow)
  client_secret + no RT        → MicrosoftSPCredential (client_credentials flow)
  private_key/certificate      → MicrosoftCertCredential (assertion flow)
  raw JWT string               → MicrosoftAccessToken (probe-only)
```

Option B: Separate providers per credential type (e.g., `google-sa`, `microsoft-sp`)
- Pro: cleaner separation of auth flows
- Con: more providers to register, duplicated nav items

**Recommendation:** Option A (sub-types) for Google and Microsoft, Option B only for Azure DevOps (truly different API surface).

### Token Cache Architecture Changes

Current: single access token cache per credential
Proposed: per-resource token cache (especially for Microsoft resource pivoting)

```
Cache key: {provider}:{credential_hash}:{resource_audience}
Example:   microsoft:abc123:graph.microsoft.com
           microsoft:abc123:management.azure.com
           microsoft:abc123:vault.azure.net
```

### UI Changes Needed

1. **Capability Matrix (on import):** After adding a credential, auto-probe and show what it can access
2. **Resource Switcher:** For Microsoft, toggle between Graph / ARM / Key Vault / etc.
3. **Impersonation Panel:** For Google DWD, select target user
4. **User Picker:** For Microsoft app-only tokens, select which user's data to browse
5. **Token Countdown:** For raw access tokens, show live expiry timer
6. **OPSEC Dashboard:** Alerts, risk detections, activity log monitoring

---

## Part 6: Unified Priority Tiers

### Tier 1 — Next Sprint (Low effort, massive value)

| # | Feature | Provider | Effort | Value | Key Deliverable |
|---|---------|----------|--------|-------|-----------------|
| 1 | Resource Pivot Probing | Microsoft | LOW | CRITICAL | Auto-discover ARM/KeyVault/Storage access from existing RT |
| 2 | FOCI Client ID Pivoting | Microsoft | LOW | CRITICAL | Try all FOCI IDs, show capability matrix |
| 3 | Admin Reports API | Google | LOW | CRITICAL | OPSEC: see admin actions, login events, detections |
| 4 | Alert Center API | Google | LOW | CRITICAL | OPSEC: see active security alerts |
| 5 | Conditional Access Policies | Microsoft | LOW | CRITICAL | See the M365 security perimeter |
| 6 | Authentication Methods | Microsoft | LOW | CRITICAL | MFA coverage gaps, attack planning |
| 7 | Identity Protection | Microsoft | LOW | HIGH | Risky users/sign-ins — know if you've been flagged |
| 8 | Raw Access Token Ingestion | Both | LOW | HIGH | Accept ya29.*/JWT tokens with countdown |
| 9 | Azure CLI/PS Cache Import | Microsoft | LOW | CRITICAL | Auto-detect msal_token_cache.json format |
| 10 | gcloud Credential Import | Google | LOW | HIGH | Auto-detect ADC authorized_user format |

### Tier 2 — Major Features (Medium effort, high value)

| # | Feature | Provider | Effort | Value | Key Deliverable |
|---|---------|----------|--------|-------|-----------------|
| 11 | Service Account Keys | Google | MEDIUM | CRITICAL | JWT signing, scope selector UI |
| 12 | Domain-Wide Delegation | Google | MEDIUM | CRITICAL | User impersonation panel, batch ops |
| 13 | Service Principal Auth | Microsoft | MEDIUM | CRITICAL | Client credentials flow, user picker |
| 14 | SharePoint Sites/Lists | Microsoft | MEDIUM | HIGH | Site browser, document library access |
| 15 | Google Chat API | Google | LOW | HIGH | Internal chat message browser |
| 16 | App Registrations & SPs | Microsoft | MEDIUM | CRITICAL | Audit: enumerate apps, permissions, secrets metadata |
| 17 | PIM (Eligible Roles) | Microsoft | MEDIUM | CRITICAL | Escalation map: who can become Global Admin |
| 18 | Google Vault (eDiscovery) | Google | MEDIUM | CRITICAL | Cross-org search + export |
| 19 | Drive Activity API | Google | LOW | HIGH | File access audit trail |
| 20 | Google Cloud IAM | Google | MEDIUM | CRITICAL | Permission mapping, SA key listing |

### Tier 3 — Infrastructure Modules (High effort, high value)

| # | Feature | Provider | Effort | Value | Key Deliverable |
|---|---------|----------|--------|-------|-----------------|
| 21 | ARM Module (Azure infra) | Microsoft | HIGH | CRITICAL | Key Vault, VMs, Storage, App Service |
| 22 | Security API + Advanced Hunting | Microsoft | MEDIUM-HIGH | CRITICAL | "See what the SOC sees" + KQL |
| 23 | Intune Device Management | Microsoft | MEDIUM | HIGH | Device fleet, compliance, configs |
| 24 | Azure DevOps (new provider) | Microsoft | MEDIUM | CRITICAL | Repos, pipelines, variable groups |
| 25 | Google Cloud Logging | Google | MEDIUM | HIGH | GCP audit logs, OPSEC |
| 26 | eDiscovery (M365 Purview) | Microsoft | HIGH | HIGH | Cross-service content search |
| 27 | Certificate-Based SP Auth | Microsoft | MEDIUM-HIGH | HIGH | JWT assertion with X.509 cert |
| 28 | Chrome Browser Management | Google | MEDIUM | HIGH | Endpoint security posture |

### Tier 4 — Advanced / Long-term

| # | Feature | Provider | Effort | Value |
|---|---------|----------|--------|-------|
| 29 | PRT Cookie Import | Microsoft | HIGH | CRITICAL |
| 30 | Google Browser Cookie → Token | Google | HIGH | CRITICAL |
| 31 | Device Code Flow | Microsoft | LOW | HIGH |
| 32 | App-Specific Passwords (IMAP) | Google | MEDIUM | MEDIUM |
| 33 | Cross-Tenant Access Analysis | Microsoft | LOW | HIGH |
| 34 | Workload Identity Federation | Both | HIGH | MEDIUM-HIGH |
| 35 | Google Marketplace App Audit | Google | MEDIUM | HIGH |

---

## Part 7: Key Limitations & Caveats

### Scope-dependent access
Most new Google API surfaces only work if the ingested token was granted the relevant scopes during the original OAuth consent. Ninken should probe available scopes on import and gray out inaccessible features.

### Admin consent requirements
Many Microsoft Graph scopes (`Policy.Read.All`, `SecurityEvents.Read.All`, device management) require admin consent. Tokens from non-admin users won't have these. Ninken should gracefully handle 403s and display which scopes would be needed.

### OPSEC considerations
- Accessing security APIs (alerts, risk detections) may itself generate alerts
- eDiscovery searches leave audit trails
- Intune/device management scopes are often flagged by CASB/SIEM
- CA policy reading is a high-signal action in mature environments
- Rate limiting API calls matters — burst activity triggers anomaly detection

### License requirements
- Google Vault requires Business Plus / Enterprise
- Microsoft Identity Protection requires Azure AD P2
- Microsoft eDiscovery requires E5 or compliance add-on
- Microsoft PIM requires Azure AD P2
- Ninken should detect available features from license indicators

### Token lifetime awareness
- Google access tokens: ~1 hour
- Microsoft access tokens: 60-90 minutes (CAE tokens up to 28 hours)
- Refresh tokens: up to 90 days (Microsoft), indefinite (Google, if used)
- Service account JWT: re-sign every hour (no refresh token)
- Raw access tokens: no refresh — dead on expiry
- PRT: device-bound, complex lifetime rules

---

## Appendix: Cross-Platform Feature Comparison

| Capability | Google | Microsoft |
|-----------|--------|-----------|
| Email access | Gmail API | Outlook (Graph) |
| File storage | Drive API + GCS | OneDrive + SharePoint |
| Calendar | Calendar API | Calendar (Graph) |
| Chat/messaging | Chat API | Teams (Graph) |
| Directory | Admin Directory | Entra ID (Graph) |
| eDiscovery | Vault API | Purview eDiscovery |
| Security alerts | Alert Center | Defender / Security API |
| Audit logs | Reports API | Unified Audit Log |
| DLP rules | Admin SDK Alerts | Purview DLP |
| Device management | Chrome Management | Intune |
| Cloud infrastructure | GCP (IAM, Compute, Storage, KMS) | Azure (ARM, Key Vault, Storage) |
| Privileged access | Admin roles + DWD | PIM + CA policies |
| Code repos | N/A (GitHub is separate) | Azure DevOps |
| Service accounts | SA keys + DWD | Service principals + certificates |
| SSO/Federation | SAML/OIDC (IdP or SP) | SAML/OIDC + PRT |
| Token pivoting | Scope-based (limited) | Resource pivot + FOCI (extensive) |

---

*This is a brainstorm document. Detailed research for each item is in the companion documents.*
