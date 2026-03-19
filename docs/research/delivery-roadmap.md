# Delivery Roadmap — Token Expansion

**Date:** 2026-03-19
**Status:** Phase 0 Complete
**Principle:** Foundation before features. Every hour on Phase 0 prevents 10+ hours of rewriting later.

---

## The Refactor Math

There are **~50 Google API routes** calling `getTokenFromRequest()` which returns an OAuth-only `TokenData` shape. Every new Google module (Reports API, Alert Center, Vault, IAM, etc.) adds 2-5 more routes using this same pattern. If we ship Phase 1 modules first (adding ~15 routes) then refactor, that's **65 routes** to rewrite instead of 50. If Phase 2 and 3 also ship pre-refactor, we're at **80+ routes**.

Similarly, `microsoft.ts` hardcodes `graph.microsoft.com/.default` as the scope and the token cache has no resource dimension. Every Azure feature built on this requires rework once we add ARM/Key Vault/Storage support.

**Phase 0 exists to prevent this compounding debt.**

---

## Phase 0: Foundation — Prevent Refactor Debt ✅ COMPLETED (2026-03-19)

**Theme:** Build the ground floor before raising walls.
**Effort:** ~1 sprint. All items parallelizable except F5 depends on F1.
**User-visible value:** Zero. Pure infrastructure.
**Status:** All items completed — F1, F2, F3, F5, F6 + all lower-priority fixes.

### F1: Add `credentialKind` discriminator to `BaseCredential`

| | |
|---|---|
| **What** | Add optional `credentialKind?: CredentialKind` field to `BaseCredential` in `types.ts`. Set `"oauth"` during Google `validateCredential()`, `"foci"` during Microsoft. |
| **Why now** | Every future credential type (SA, SP, raw token, certificate, PRT) needs this discriminator. Adding it after profiles exist in IndexedDB requires migration. Adding it now with `?` means existing profiles work unchanged. |
| **Files** | `src/lib/providers/types.ts` |
| **Effort** | LOW (~1 day) |
| **Blocks** | F4, F5, every new credential type |

### F2: Refactor Google API routes to bearer-token factories

| | |
|---|---|
| **What** | Change ~50 Google API routes from `getTokenFromRequest()` → `TokenData` → `createGmailService(token)` to `getCredentialFromRequest()` → `provider.getAccessToken(credential)` → `createGmailServiceFromToken(bearerString)`. Create bearer-string-based service factories in `google.ts`. |
| **Why now** | This is the single highest-leverage refactor. Every Google API route added before this change is another route that needs rewriting. The `TokenData` type from `auth.ts` is structurally Google-OAuth-only (`client_secret` required). SA keys, DWD, raw tokens, and gcloud imports all need the bearer-token path. |
| **Files** | `src/lib/google.ts` (new factories), `src/app/api/_helpers.ts` (deprecate `getTokenFromRequest`), ~50 routes under `src/app/api/gmail/`, `drive/`, `calendar/`, `gcp/`, `audit/`, `directory/`, `chat/` |
| **Effort** | MEDIUM (~3-5 days, mechanical find-and-replace) |
| **Blocks** | FEAT-1 (SA keys), FEAT-2 (DWD), FEAT-4 (raw Google tokens), all future Google modules |

### F3: Per-resource Microsoft token cache

| | |
|---|---|
| **What** | Add `resource` parameter to `refreshAccessToken()` and `getAccessToken()` in `microsoft.ts`. Change `credentialKey()` from `${tenant}:${client}:${rt_prefix}` to `${tenant}:${client}:${rt_prefix}:${resource}`. Default resource to `graph.microsoft.com/.default`. |
| **Why now** | One-line change that unblocks the entire Azure infrastructure stack. Without it, requesting a Graph token and an ARM token for the same credential causes cache collision — the cache returns the wrong token silently. |
| **Files** | `src/lib/microsoft.ts` (lines 9-11, 45-78) |
| **Effort** | LOW (~1 day) |
| **Blocks** | FEAT-7 (resource pivot), FEAT-8 (FOCI pivot), MOD-1 (ARM), MOD-2 (Key Vault) |

### F5: Non-refreshable credential support in token refresher

| | |
|---|---|
| **What** | Add `canRefresh?(credential: BaseCredential): boolean` to `ServiceProvider` interface. Token refresher checks it before attempting refresh. Add countdown-only display mode for expiring credentials. |
| **Why now** | Without this, raw access tokens and managed identity tokens produce permanent false-failure events every 45 minutes. The error states propagate to the UI. |
| **Files** | `src/lib/providers/types.ts`, `src/lib/token-refresher.ts` (line 51), both provider implementations |
| **Effort** | LOW (~1 day) |
| **Blocks** | FEAT-4 (raw access tokens) |

### F6: Microsoft format detection expansion

| | |
|---|---|
| **What** | Extend Microsoft `detectCredential`/`normalizeRaw` to recognize Azure CLI MSAL cache format (`msal_token_cache.json`), Azure PowerShell format (`AzureRmContext.json`), service principal JSON (`client_id` + `client_secret` + `tenant_id`, no `refresh_token`), and raw JWT strings. |
| **Why now** | Cheap detection logic that enables FEAT-5 (Azure CLI import), FEAT-3 (SP auth), and FEAT-4 (raw Microsoft tokens) without any further changes to the detection layer. |
| **Files** | `src/lib/providers/microsoft.ts` (`normalizeRaw`, `isMicrosoftShape`) |
| **Effort** | LOW (~1 day) |
| **Blocks** | FEAT-5 (Azure CLI import), FEAT-3 (SP auth) |

### Also in Phase 0 (lower priority, no dependencies): ✅ ALL COMPLETED

- ✅ **Move `minimalCredential()` to `ServiceProvider` interface** — Eliminated hardcoded switch. Each provider now implements `minimalCredential()`.
- ✅ **Deprecate `getTokenFromRequest` with JSDoc** — All routes migrated to `getGoogleAccessToken()`. Old function kept with `@deprecated` for backward compat.
- ✅ **Fix `token-info/route.ts` `|| "google"` default** — Removed fallback, now uses `getCredentialFromRequest()` to determine provider.
- ✅ **Fix AI layer hardcoded union** — Changed to `ProviderId` with fallback for unknown providers.

---

## Phase 1: Quick Wins — Maximum Value From Existing Credentials

**Theme:** New API surfaces on tokens Ninken already ingests. No new auth flows.
**Effort:** ~2-3 sprints. All items independent and parallelizable.
**Prerequisite:** F3 (for Microsoft resource features), F6 (for Azure CLI import).

### OPSEC Intelligence (Google)

| Module | What | Effort | Value |
|--------|------|--------|-------|
| **Admin Reports API** | Admin actions, login events, token grants, file sharing — see what the SOC is monitoring | LOW | CRITICAL |
| **Alert Center** | Active security alerts — see if your activity triggered detections | LOW | CRITICAL |
| **Drive Activity API** | File access audit trail — who accessed what, when, permission changes | LOW | HIGH |
| **Groups Settings** | Per-group external member/posting permissions — lateral movement targeting | LOW | HIGH |
| **Contacts/People API** | "Other contacts" auto-saved from email — network mapping | LOW | MEDIUM-HIGH |

### OPSEC Intelligence (Microsoft)

| Module | What | Effort | Value |
|--------|------|--------|-------|
| **CA Policy Viewer** (enhance existing) | Full CA policy details, named locations, excluded groups | LOW | CRITICAL |
| **Authentication Methods** | Per-user MFA methods, coverage gaps — attack planning | LOW | CRITICAL |
| **Identity Protection** (enhance existing) | Risk detections, risky users — see if you've been flagged | LOW | HIGH |
| **Cross-Tenant Access** | B2B trust settings — lateral movement paths between tenants | LOW | HIGH |

### Credential Capabilities (Microsoft)

| Feature | What | Effort | Value |
|---------|------|--------|-------|
| **Resource Pivot Probing** | Try ARM, Key Vault, Storage, DevOps scopes on existing refresh token → show capability matrix | LOW | CRITICAL |
| **FOCI Client ID Pivoting** | Try all 13 FOCI client IDs → discover maximum access breadth | LOW | CRITICAL |
| **Azure CLI/PS Cache Import** | Detect `msal_token_cache.json` format, extract all accounts as profiles | LOW | CRITICAL |

### Credential Import (Google)

| Feature | What | Effort | Value |
|---------|------|--------|-------|
| **gcloud Credential Import** | Detect `"type":"authorized_user"` ADC format explicitly | LOW | HIGH |

---

## Phase 2: New Credential Types — Expand the Ingestion Surface

**Theme:** Accept what red teamers actually find on compromised systems.
**Effort:** ~2-3 sprints. F4 first, then FEAT-1 and FEAT-3 in parallel.
**Prerequisite:** Phase 0 complete (F1, F2, F4 specifically).

| Item | What | Provider | Effort | Value | Depends on |
|------|------|----------|--------|-------|------------|
| **Cookie size solution (F4)** | Store derived access tokens in cookie for large credentials (SA keys, certs) | Both | MEDIUM | enabler | F1 |
| **Service Account Keys** | Detect `"type":"service_account"`, JWT signing (RS256), scope selector UI | Google | MEDIUM | CRITICAL | F1, F2, F4 |
| **Service Principal Auth** | `client_id` + `client_secret` + `tenant_id`, `grant_type=client_credentials`, user picker for app-only tokens | Microsoft | MEDIUM | CRITICAL | F1, F4, F6 |
| **Raw Access Token Ingestion** | Accept `ya29.*` and JWT `eyJ...`, auto-detect provider, scope probe, live expiry countdown | Both | LOW | HIGH | F1, F2, F5 |
| **Capability Probing on Import** | After import, async probe available scopes/resources, gray out inaccessible features | Both | MEDIUM | MEDIUM | F3, FEAT-7 |

### Architecture milestone: Introduce `CredentialStrategy` pattern

Per the architecture decision (`architecture-decision-credential-types.md`), Phase 2 is when the strategy pattern earns its keep. When implementing SA keys or SP auth, extract current OAuth/FOCI logic into strategy files and add new strategy files for the new credential types.

```
src/lib/providers/
  google/
    strategies/
      oauth.ts            (extracted from current google.ts)
      service-account.ts  (NEW)
      access-token.ts     (NEW)
  microsoft/
    strategies/
      foci.ts             (extracted from current microsoft.ts)
      service-principal.ts (NEW)
      access-token.ts     (NEW)
```

---

## Phase 3: Power Features — DWD, ARM, PIM, Vault

**Theme:** Category-defining capabilities. Major escalation vectors and infrastructure access.
**Effort:** ~4-6 sprints.
**Prerequisite:** Phase 2 credential types (DWD needs SA keys, ARM needs resource cache).

### Google Power Features

| Module | What | Effort | Value | Depends on |
|--------|------|--------|-------|------------|
| **Domain-Wide Delegation** | SA key + `sub` claim → impersonate any Workspace user. Impersonation panel, target picker, batch ops. | MEDIUM | CRITICAL | FEAT-1 (SA keys) |
| **Vault (eDiscovery)** | Cross-org search across all mailboxes/Drives. Export complete mailboxes. | MEDIUM | CRITICAL | — |
| **Cloud IAM Enumeration** | `testIamPermissions` per project, SA key listing, role binding map | MEDIUM | CRITICAL | — |

### Microsoft Power Features

| Module | What | Effort | Value | Depends on |
|--------|------|--------|-------|------------|
| **ARM Module** | Subscriptions, VMs, storage accounts, App Service configs, network topology | HIGH | CRITICAL | F3, FEAT-7 |
| **Key Vault Browser** | Secrets (names + metadata), certificates, keys via `vault.azure.net` scope | MEDIUM | CRITICAL | F3 |
| **PIM (Eligible Roles)** | Who CAN become Global Admin — the escalation map | MEDIUM | CRITICAL | — |
| **App Registrations Audit** | All apps, permissions, owners, secrets metadata, OAuth consent grants | MEDIUM | CRITICAL | — |
| **Security API + Hunting** | Defender alerts, incidents, secure score, KQL advanced hunting editor | MEDIUM-HIGH | CRITICAL | — |
| **SharePoint Sites/Lists** | Site enumeration, document library browser with site picker | MEDIUM | HIGH | — |

---

## Phase 4: Breadth — Fill Remaining Attack Surface

**Theme:** Complete coverage across both ecosystems.
**Effort:** ~4-5 sprints.

| Module | Provider | Effort | Value |
|--------|----------|--------|-------|
| **Azure DevOps** (new provider) | Microsoft | MEDIUM | CRITICAL |
| **Intune Device Inventory** | Microsoft | MEDIUM | HIGH |
| **eDiscovery (Purview)** | Microsoft | HIGH | HIGH |
| **Cloud Logging** | Google | MEDIUM | HIGH |
| **Marketplace App Audit** | Google | MEDIUM | HIGH |
| **Certificate-Based SP Auth** | Microsoft | MEDIUM-HIGH | HIGH |
| **Device Code Flow** | Microsoft | LOW | HIGH |

---

## Phase 5: Advanced / R&D

**Theme:** Specialized attack vectors with significant crypto/protocol complexity.
**Effort:** Ongoing.

| Feature | Provider | Effort | Value | Notes |
|---------|----------|--------|-------|-------|
| PRT Cookie Import | Microsoft | HIGH | CRITICAL | Complex crypto, nonce management |
| Browser Cookie → Token | Google | HIGH | CRITICAL | Cookie handling, consent automation |
| Azure AD Connect Sync | Microsoft | MEDIUM | CRITICAL | ROPC flow |
| Workload Identity Federation | Both | HIGH | MEDIUM-HIGH | External IdP exchange |
| App-Specific Passwords | Google | MEDIUM | MEDIUM | IMAP/SMTP paradigm |
| SAML/Golden SAML | Both | HIGH | HIGH | Attack chain, not data browsing |

---

## Critical Path Visualization

```
CRITICAL PATH 1 (Google DWD):
  F1 (credentialKind) ─► F4 (cookie size) ─► FEAT-1 (SA keys) ─► FEAT-2 (DWD)
  F2 (bearer factory) ──────────────────────┘

CRITICAL PATH 2 (Azure Infrastructure):
  F3 (resource cache) ─► FEAT-7 (resource pivot) ─► MOD-1 (ARM) ─► MOD-2 (Key Vault)

INDEPENDENT (ship anytime after Phase 0):
  MOD-3 (Reports API) ─── no deps
  MOD-4 (Alert Center) ── no deps
  MOD-5 (CA Policies) ─── no deps
  MOD-9 (PIM) ─────────── no deps
  MOD-12 (Vault) ──────── no deps
  MOD-13 (Cloud IAM) ──── no deps
```

---

## UX: Menu Overlay + Service Landing Page ✅ COMPLETED (2026-03-19)

**Priority:** HIGH — affects every navigation interaction
**Effort:** MEDIUM (~1 sprint)
**Prerequisite:** None (independent of API/credential work)
**Status:** Implemented — sidebar overlay, service switcher, Google/Microsoft dashboards, AI chat panel moved to floating card.

### Menu Overlay Navigation

| | |
|---|---|
| **What** | When navigating between services (Gmail, Drive, Calendar, etc.), the left sidebar dynamically replaces its content with the active service's menu. At the top of the sidebar: the active service name + icon, a service switcher dropdown to jump to another service or back to the **Service Landing Page**. Below: service-specific navigation (e.g., Gmail → Inbox, Starred, Sent, Drafts, Labels; Drive → My Drive, Shared Drives, Recent, Starred). |
| **Why** | Current sidebar shows a flat list of all services at all times. For services with deep navigation (Gmail labels, Drive folder trees, Audit sub-pages), the sidebar can't provide contextual navigation. The overlay pattern (used by Slack, VS Code, Notion) gives each service full sidebar real estate while keeping cross-service switching one click away. |
| **Current behavior** | Sidebar lists all services. Clicking "Gmail" navigates to `/gmail`. Service-specific nav (labels, folders) lives inside each page's own layout, creating inconsistent patterns. |
| **Target behavior** | Clicking "Gmail" → sidebar morphs to Gmail menu (Inbox, Starred, Sent, Drafts, Labels). Top of sidebar shows "Gmail" with a dropdown to switch to Drive, Calendar, etc. or return to the Service Landing Page. Each service defines its own sidebar menu items. |
| **Files** | `src/components/app-sidebar.tsx` (major rewrite), provider `operateNavItems` (extend with sub-items), `src/app/(google)/layout.tsx`, `src/app/(microsoft)/layout.tsx` |
| **Design notes** | Service switcher at top of sidebar — compact dropdown or segmented control. Back arrow or home icon to return to Service Landing Page. Active service highlighted. Smooth transition when switching (no full page reload). |

### Service Landing Page

| | |
|---|---|
| **What** | A provider-level dashboard that serves as the default route after authentication (instead of going straight to Gmail/Outlook). Displays: permission summary (what scopes are available, what's accessible), graphs (token expiry timeline, API usage), red team insights (high-value targets found, sensitive data indicators, privilege escalation paths), per-service accessibility matrix (green/yellow/red for each service based on scopes). |
| **Why** | Currently Google → `/gmail` and Microsoft → `/outlook` immediately. There's no overview of what the token can actually do. A landing page gives the operator situational awareness before diving into a specific service — critical for red team ops where you need to assess the full attack surface before committing to a path. |
| **Current behavior** | Auth → redirect to first service (Gmail or Outlook). No overview. |
| **Target behavior** | Auth → Service Landing Page with: scope/permission heatmap, service accessibility cards, token metadata, red team quick-wins summary. Each card links to the corresponding service. |
| **Routes** | `src/app/(google)/page.tsx` (new), `src/app/(microsoft)/page.tsx` (new) |
| **Design notes** | Design TBD — will include graphs, statistics, permissions summary, insights, red team insights. Think ROADtools-style dashboard meets Bloodhound overview. Dark theme, data-dense, actionable. |
| **Blocks** | Nothing — can be iteratively enhanced as new modules ship. Start with scope summary + service cards, add graphs and insights over time. |

---

## Hardcoded Assumptions — Fix Priority

These are the exact locations that cause cascading breakage if not addressed. Ordered by "fix now to avoid pain later":

| # | File | Line | What's Hardcoded | Fix Cost Now | Fix Cost Later |
|---|------|------|------------------|-------------|----------------|
| 1 | `microsoft.ts` | 59 | `graph.microsoft.com/.default` scope | LOW | HIGH (blocks all Azure) |
| 2 | `microsoft.ts` | 9-11 | Cache key has no resource dimension | LOW | HIGH (cache collision bugs) |
| 3 | `_helpers.ts` | 24 | `provider === "google"` in `getTokenFromRequest` | LOW | HIGH (50+ routes depend on it) |
| 4 | `google.ts` (lib) | 3-43 | All service factories accept `TokenData` only | MEDIUM | HIGH (grows with every module) |
| 5 | `activate/route.ts` | 31-53 | `minimalCredential` is hardcoded switch | LOW | MEDIUM (must edit per provider) |
| 6 | `auth.ts` | 1-7 | `TokenData` is Google-OAuth-only, still in active use | LOW | MEDIUM (type confusion) |
| 7 | `token-info/route.ts` | 12,72 | `provider === "microsoft"` branch, `\|\| "google"` fallback | LOW | MEDIUM (wrong path for new providers) |
| 8 | `token-refresher.ts` | 51-61 | No `canRefresh` check before attempting refresh | LOW | MEDIUM (false failures for raw tokens) |
| 9 | `ai/tools.ts` | 154 | `"google" \| "microsoft"` independent of `ProviderId` | LOW | MEDIUM (wrong tools for new providers) |
| 10 | Microsoft routes | all | `/me/` endpoints break with app-only tokens | LOW (document) | HIGH (25 routes to audit for SP) |

---

## Summary

| Phase | Theme | Effort | Visible Value |
|-------|-------|--------|---------------|
| **0** | Foundation (refactor prevention) | ~1 sprint | None (infrastructure) |
| **1** | Quick wins on existing tokens | ~2-3 sprints | 13 new modules/features, all CRITICAL/HIGH |
| **2** | New credential types + strategies | ~2-3 sprints | SA keys, SP auth, raw tokens |
| **3** | Power features (DWD, ARM, PIM, Vault) | ~4-6 sprints | Category-defining capabilities |
| **4** | Breadth (DevOps, Intune, Purview, certs) | ~4-5 sprints | Complete coverage |
| **5** | Advanced (PRT, browser cookies, SAML) | Ongoing | Specialized attack vectors |

**The key insight:** Phase 0 and Phase 1 can overlap. While one track does the mechanical F2 refactor (bearer-token factories), another track ships Phase 1 modules that don't touch Google routes (all Microsoft features, gcloud import). The constraint is: **no new Google API routes until F2 lands.**
