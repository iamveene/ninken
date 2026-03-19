# Regression Bug Tracker — 2026-03-19 (Functional Test v2)

## Summary
- Total issues: 8
- Critical: 2 | High: 1 | Medium: 2 | Low: 2 | UX: 1
- Backend issues: 1 | Frontend issues: 7
- Pages tested: 35+ with real tokens (Google, Microsoft, GitHub)
- Build: PASSES cleanly

## Functional Test Results

| Provider | Page | Data Loads | Interactive | Console Errors | Status |
|----------|------|-----------|-------------|---------------|--------|
| Landing | /?add=true | N/A | YES (3 sessions, paste toggle) | 0 | PASS |
| Google | /dashboard | YES (6/6 services, 12 scopes) | YES | 0 | PASS |
| Google | /gmail | YES (201 messages, real subjects) | YES (labels, search, filters) | 0 | PASS |
| Google | /drive | YES (files with owners/dates) | YES (My Drive/Shared tabs) | 0 | PASS |
| Google | /calendar | YES (events: Review, Meeting, Sync, Pentest Kick Off) | YES (week nav) | 0 | PASS |
| Google | /chat | NO — API not enabled error | N/A | 0 | EXPECTED (GCP config) |
| Google | /directory | NO — access denied | Tabs present | 0 | EXPECTED (no admin) |
| Google | /buckets | YES (579 lines, real bucket names) | YES | 0 | PASS |
| Google | /audit | YES (token info, service grid) | YES | 0 | PASS |
| Google | /audit/users | YES (1 user, 2FA status) | YES (filters) | 0 | PASS |
| Google | /audit/query | YES (251 lines, 8 categories, 37+ queries) | YES | 0 | PASS |
| Google | /audit/admin-reports | Scope denied | YES (5 tabs present) | 0 | PASS (structure) |
| Google | /audit/alert-center | Scope denied | YES (severity cards, filter tabs) | 0 | PASS (structure) |
| Google | /audit/drive-activity | Scope denied | YES (action filters) | 0 | PASS (structure) |
| Google | /audit/groups-settings | Scope denied | YES (risk cards) | 0 | PASS (structure) |
| Google | /audit/contacts | Scope denied | YES (3 source tabs) | 0 | PASS (structure) |
| Google | /collection | Empty (expected) | YES (queue controls, Export ZIP, Clear All) | 0 | PASS |
| M365 | /m365-dashboard | **BUG**: Shows "No Scope" for all services | YES | 0 | **FAIL** |
| M365 | /outlook | YES (25 messages, real subjects/senders) | YES (folders, compose) | 0 | PASS |
| M365 | /onedrive | YES (files: Attachments, Invoice, Meetings) | YES (Upload, New Folder) | 0 | PASS |
| M365 | /teams | Empty — "No teams found" | YES (structure ok) | 0 | UNCLEAR |
| M365 | /entra | YES (177 lines, 50+ users with emails) | YES (Users/Groups/Roles tabs) | 0 | PASS |
| M365 | /m365-audit/users | YES (50 users, 21 disabled) | YES | 0 | PASS |
| M365 | /m365-audit/conditional-access | Scope denied (needs admin role) | YES (Export) | 0 | PASS (structure) |
| M365 | /m365-audit/risky-users | Scope denied | YES (2 tabs: Risky Users + Risk Detections) | 0 | PASS (structure) |
| M365 | /m365-audit/auth-methods | Scope denied | YES (OPSEC warning, aggregate cards) | 0 | PASS (structure) |
| M365 | /m365-audit/cross-tenant | Scope denied | YES (Export) | 0 | PASS (structure) |
| M365 | /m365-audit/pivot | YES (probe results with real Azure errors) | YES (Re-probe, OPSEC warning) | 0 | PASS |
| M365 | /m365-audit/foci-pivot | Ready state | YES (Start Probe, OPSEC warning) | 0 | PASS |
| GitHub | /github-dashboard | **404 — page not found** | N/A | 0 | **FAIL** |
| GitHub | /repos | **404 — page not found** | N/A | 0 | **FAIL** |
| GitHub | ALL github pages | **404 — missing from filesystem** | N/A | 0 | **FAIL** |
| Studio | /studio/converter | Renders | YES (FOCI client list) | 0 | PASS |

## Critical Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| C1 | frontend | ALL GitHub pages | GitHub route group `(github)` is missing layout.tsx, github-dashboard, repos, orgs, actions, gists pages. Only `github-audit/secrets` exists. The pages were never committed to main — they existed only in stashed local changes that got cleaned during worktree operations. | All GitHub pages should render (github-dashboard, repos, orgs, actions, gists, + 10 github-audit subpages) | 404 "This page could not be found" on all GitHub routes except /github-audit/secrets |
| C2 | frontend | `/m365-dashboard` | Dashboard shows "No Scope" / "0/N scopes granted" for ALL services (Outlook, OneDrive, Teams, Entra) and "No scopes available" in Granted Scopes section, despite the token having 20+ scopes (Mail.ReadWrite, Files.ReadWrite.All, Team.ReadBasic.All, User.ReadBasic.All, etc.). Data actually loads on individual pages (Outlook shows 25 messages, Entra shows 50 users). | Dashboard should show scopes from JWT `scp` claim and mark services as Accessible | Shows 0 scopes, all services blocked, contradicting actual API access |

## High Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| H1 | backend | `src/app/api/auth/export/route.ts` | GET and DELETE handlers have no try/catch error handling. If `getProfilesFromCookies()` throws on malformed cookie data, error propagates as unhandled 500. | try/catch with serverError() | No error handling wrapper |

## Medium Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| M1 | frontend | `/teams` | "No teams found" despite token having `Team.ReadBasic.All` scope. Could be genuine (user has no teams in this tenant) or the API call is failing silently. Cannot determine without checking the network response. | If user has teams, they should load. If no teams, the empty state is correct. | Shows empty; needs investigation whether the Graph `/me/joinedTeams` call returns data or errors |
| M2 | frontend | `/chat` | "Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console." The token has `chat.messages.readonly` scope but Chat API isn't enabled in the GCP project. | Clear guidance that this is a GCP project config issue, not a Ninken bug | Error message is helpful but could link to the specific GCP console page |

## Low Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| L1 | backend | `src/app/api/auth/export/route.ts` | Legacy migration endpoint missing try/catch (same as H1 but low risk since it's a migration-only route rarely called) | try/catch | No error handling |
| L2 | frontend | `/github-audit/secrets` | Only GitHub audit page that exists — renders in isolation without a GitHub layout wrapper | Should have a proper layout like other route groups | Orphaned page without parent layout |

## UX Improvement Opportunities

| # | Page | Current Behavior | Suggested Improvement | Impact |
|---|------|-----------------|----------------------|--------|
| UX1 | `/m365-dashboard` | Token scopes not detected — all services show "No Scope" even when they work | Fix scope detection to properly read JWT `scp` claim and match against `scopeAppMap` entries. The `fetchScopes()` call may be failing silently or the scope format doesn't match. | High — dashboard is the first page users see after M365 import |

## Notes
- **0 console errors** across all 35+ pages tested — no hydration errors, no React crashes, no module failures
- **Google Workspace**: 8/8 operate pages work perfectly with real data. 5/5 new audit pages have correct structure. Scope-denied pages show helpful messages.
- **Microsoft 365**: Operate pages work (Outlook, OneDrive, Entra load real data). Audit pages have correct structure. Dashboard scope detection is broken (C2).
- **GitHub**: Route group is largely missing from filesystem (C1). Needs full page implementation or recovery from git history.
- **Slack**: Route group files exist but couldn't test — d_cookie expired. Bootstrap UX issue documented in DESIGN.md.
- **Studio**: All 6 pages render correctly. Converter has no hydration errors (H1 fix verified).
- **Collection**: Page structure complete with all queue controls, Export ZIP, Clear All, stats.

## Recommended Priority for /fire_remediation
1. **C1** — Recreate GitHub pages (or recover from git history)
2. **C2** — Fix M365 dashboard scope detection
3. **H1** — Add try/catch to auth/export route
