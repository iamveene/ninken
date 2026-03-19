# Architecture Decision: Multi-Credential Type Support

**Date:** 2026-03-19
**Status:** Brainstorm / Decision pending
**Context:** Ninken needs to support 5-6 credential types per provider (OAuth, Service Account, Client Credentials, Raw Access Token, Certificate, etc.). Three architectural options were analyzed against every touchpoint in the codebase.

---

## Options Evaluated

| | Option A | Option B | Option C |
|---|---|---|---|
| **Approach** | Sub-types within existing providers | Separate provider per credential type | Ecosystem providers + credential strategies |
| **ProviderId** | Stays `"google" \| "microsoft"` | Grows to 14-23+ entries | Stays `"google" \| "microsoft"` |
| **New concept** | `credentialKind` discriminator on credential | None (more providers) | `CredentialStrategy` interface |
| **File structure** | Logic grows inside `google.ts`, `microsoft.ts` | New files: `google-sa.ts`, `microsoft-sp.ts`, etc. | New dirs: `google/strategies/oauth.ts`, etc. |

---

## Universal Blockers (Affect ALL Options)

These two problems exist regardless of which option is chosen. They must be solved first.

### Blocker 1: Cookie 4KB Limit

**The problem:** `minimalCredential()` in `activate/route.ts:31` strips credentials to fit in the `ninken_token` httpOnly cookie (max ~4000 bytes). A Google SA private key alone is ~1700 bytes. Microsoft certificates can be 2-3KB. These credentials **cannot fit** in the current cookie architecture.

**The current flow:**
```
IndexedDB (encrypted, full credential)
  → activateProfile() POSTs to /api/auth/activate
  → minimalCredential() strips to essential fields
  → ninken_token cookie (httpOnly, 4KB max)
  → API routes read cookie via getCredentialFromRequest()
```

**Why server-side cache is wrong:** Ninken uses Next.js API routes. In serverless deployments, each request may be a cold start — an in-memory map is empty. Process restarts lose all credentials. This is a deployment-breaking footgun.

**Proposed solution:** For large credentials (SA keys, certificates), the activate endpoint stores only a signed session reference in the cookie. The full credential is re-posted from IndexedDB on each activation, and the server-side token cache (which already exists in `microsoft.ts:7` for access tokens) holds the **derived access token**, not the raw credential. SA keys can re-sign JWTs client-side, so the server never needs the private key — it only needs the resulting access token. The activate route for SA credentials could accept a pre-signed JWT or a freshly-obtained access token.

**Alternative:** Accept that SA/certificate profiles require re-activation after server restart (the token refresher on the client re-activates the active profile every 45 minutes already via `token-refresher.ts:63`).

### Blocker 2: `getTokenFromRequest()` Returns OAuth-Only `TokenData`

**The problem:** All ~40 Google API routes call `getTokenFromRequest()` from `_helpers.ts:16`, which returns `TokenData` — a shape that requires `refresh_token`, `client_id`, `client_secret`. SA keys, DWD, and raw tokens don't have these fields. Every Google service factory (`createGmailService`, `createDriveService`, etc.) accepts `TokenData`.

**The fix (same for all options):** Refactor the API route pattern from:
```ts
const token = await getTokenFromRequest()  // returns TokenData (OAuth-only)
const gmail = createGmailService(token)     // uses OAuth2Client internally
```
to:
```ts
const { credential, provider } = await getCredentialFromRequest()  // already exists
const accessToken = await getProvider(provider).getAccessToken(credential)
const gmail = createGmailServiceFromToken(accessToken)  // new: accepts bearer string
```

This is a one-time refactor of `google.ts` service factories + a find-and-replace across API routes. It decouples API routes from the auth mechanism entirely.

---

## Comparison Matrix

### Type System

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| ProviderId changes | None | +8 new entries, cascades to 15+ files | None |
| New discriminator | `credentialKind` on BaseCredential | None needed (provider IS the discriminator) | `credentialKind` on BaseCredential |
| TypeScript narrowing | Double discriminant (`provider` + `credentialKind`), works but verbose | Single discriminant (`provider`), clean | Same as A |
| Existing cast breakage | Every `as GoogleCredential` now produces a union — ~20 files | No union, but every `=== "google"` check misses new providers — ~15 files | Same as A |

### Route Groups & Navigation

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Route groups | Unchanged — `(google)` and `(microsoft)` work | Unchanged but `google-sa` still routes to `(google)` — mismatch | Unchanged |
| Sidebar nav items | Static, wrong for SA credentials (shows Gmail for non-DWD SA) | Per-provider, accurate but duplicated across 4 Google providers | Dynamic via `getCapabilities()` or static with kind-aware filtering |
| Profile switching | Same provider → no navigation change | Different provider → `router.push(defaultRoute)` causes unwanted page jump | Same provider → no navigation change |
| Profile display | All Google profiles show same icon, no kind label | Same icon, no grouping concept | Same icon + `credentialKind` label |

### Scalability

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| File growth | `google.ts` grows to ~700 lines with 5 credential types | 4 new files per ecosystem, each ~150 lines | 1 coordinator + N strategy files ~80 lines each |
| Adding a new credential type | Edit existing provider file (growing if-else) | New provider file + update 15+ switch sites | New strategy file + array entry |
| At AWS scale (4 cred types) | `aws.ts` = ~500 lines | 4 separate aws-* providers | 1 coordinator + 4 strategy files |
| Detection ordering | Implicit in if-else chain | Registration order in `index.ts`, fragile | Explicit in `strategies[]` array order |

### Token Refresher

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| canRefresh handling | Need new flag on provider or credential | Each provider self-contains (clean) | Per-strategy `canRefresh` (cleanest) |
| Per-type intervals | Hard — single provider, single interval | Natural — each provider sets its own | Natural — each strategy sets its own |
| Non-refreshable tokens | Produces permanent false-failure events | Provider's `getAccessToken` can throw cleanly | Strategy says `canRefresh: false`, refresher skips |

### Duplication & Maintenance

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| `parseApiError` | Shared (one per ecosystem) | Duplicated 4x per ecosystem (or extract to shared util) | Shared (one per ecosystem) |
| `scopeAppMap` | Shared | Duplicated or shared via import | Shared |
| `operateNavItems` | Shared but wrong for some types | Correct per provider but duplicated | Shared + capability override |
| `minimalCredential()` | Hand-coded switch grows per type | Hand-coded switch grows per provider | Can be driven by `strategy.minimalFields()` |

### Detection

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| SA vs DWD | Can't auto-detect — same JSON format | Can't auto-detect — same JSON format | Can't auto-detect — same JSON format |
| Cross-ecosystem confusion | Low — provider check runs first | Higher — more providers to iterate | Low — provider check runs first |
| Format ambiguity | Handled within one provider | Ordering of 14+ providers matters | Handled within one provider's strategy array |

---

## The Verdict

### Option B: Rejected

Option B breaks the fundamental semantic that **provider = ecosystem**. The landing page service grid, profile selector, sidebar navigation, route groups, AI context, and proxy routing all assume `"google"` means "Google Workspace ecosystem." Fragmenting that into `"google"`, `"google-sa"`, `"google-dwd"`, `"google-raw"` cascades through 15+ files, requires a new "ecosystem" concept that doesn't exist, creates profile-switching UX regressions (unwanted navigation), and causes silent 401s on all 40 Google API routes until each is updated.

At AWS/GitHub scale (4 cred types per ecosystem), Option B produces 23+ provider IDs with massive duplication and a fragile detection order.

**Option B is the wrong abstraction level for this problem.**

### Option A vs Option C: It Depends on Timing

**Option A is correct today.** Each provider has exactly one credential type. The strategy pattern adds indirection over a single implementation — textbook premature abstraction. The provider files are <250 lines. There's nothing to compose.

**Option C becomes correct the moment we add a second credential type to any provider.** At that crossover point:
- Option A turns `google.ts` into a growing if-else dispatcher
- Option C keeps each auth flow in its own file, independently testable
- The `canRefresh`, `refreshInterval`, and `minimalFields()` abstractions earn their keep
- Resource pivoting (Microsoft) stays contained in the FOCI strategy

### Recommended Path: Incremental Option C

**Phase 1 — Now (preparatory, no strategies yet):**
1. Add optional `credentialKind?: CredentialKind` field to `BaseCredential` in `types.ts`
2. Set it during `validateCredential()` — `"oauth"` for Google, `"foci"` for Microsoft
3. Move `minimalCredential()` from `activate/route.ts` to a `provider.minimalCredential(credential)` method on `ServiceProvider`
4. Add `canRefresh?(credential: BaseCredential): boolean` to `ServiceProvider` (optional, defaults to `true`)
5. Refactor `getTokenFromRequest()` to use `getCredentialFromRequest()` + `provider.getAccessToken()` — decouples API routes from OAuth

These are small, non-breaking changes that prepare the ground.

**Phase 2 — When implementing Google SA or Microsoft SP:**
1. Introduce `CredentialStrategy` interface
2. Extract current OAuth/FOCI logic into `google/strategies/oauth.ts` and `microsoft/strategies/foci.ts`
3. Add `google/strategies/service-account.ts` or `microsoft/strategies/service-principal.ts`
4. Provider becomes a coordinator that delegates to strategies
5. Solve the cookie-size problem for SA keys (access-token-in-cookie, not private-key-in-cookie)

**Phase 3 — When implementing resource pivoting:**
1. Add `resource?: string` parameter to strategy's `getAccessToken`
2. Extend Microsoft token cache key with resource dimension
3. Add FOCI client ID matrix scanning on credential import

---

## Key Design Principles (Settled)

These are decided regardless of option or timing:

1. **Provider = Ecosystem.** `"google"` means Google Workspace. `"microsoft"` means Microsoft 365. Never fragment this. (Rules out Option B permanently.)

2. **Credential type is a property of the credential, not the provider.** The `credentialKind` field lives on `BaseCredential`, not on `ServiceProvider`. A single provider handles multiple credential kinds.

3. **API routes are auth-agnostic.** Routes call `getAccessToken()` and get a bearer string. They never know whether it came from OAuth, JWT signing, or client credentials. The auth mechanism is the provider's (or strategy's) internal concern.

4. **The cookie holds derived tokens, not raw secrets.** For OAuth, the refresh token is small enough. For SA keys, store the derived access token (or a signed JWT) in the cookie, not the private key. The client-side refresher re-derives and re-activates as needed.

5. **Non-refreshable credentials are first-class.** Raw access tokens and managed identity tokens expire and can't be refreshed. The token refresher must handle `canRefresh: false` with a countdown display, not error states.

---

## Appendix: SA vs DWD Detection

All three options share this unsolvable problem: a Google Service Account JSON and a DWD-capable SA JSON are **identical files**. The difference is whether the SA has been granted domain-wide delegation in Google Admin Console — information not present in the key file.

**Solution:** Don't auto-detect DWD. Import all SA keys as `service_account` type. Add an "Enable Impersonation" action in the UI that lets the operator enter a target user email. The credential's capabilities change at runtime, not at detection time. This is how ROADtools and similar tools handle it.

---

*This analysis was produced by three independent architecture review agents cross-examining every touchpoint in the codebase.*
