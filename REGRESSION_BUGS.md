# Regression Bug Tracker — 2026-03-19

## Summary
- Total issues: 14
- Critical: 0 | High: 2 | Medium: 5 | Low: 6 | UX: 1
- Backend issues: 8 | Frontend issues: 6
- Pages tested: 35 frontend + 171 API routes audited
- Build: PASSES cleanly

## High Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| H1 | frontend | `/studio/converter` | Hydration error: nested `<button>` inside `<button>` in FOCI client list items. React re-renders entire tree. 4 console errors. | No hydration errors; valid HTML nesting | Nested button violation, hydration mismatch, script tag warning |
| H2 | backend | `src/app/api/microsoft/drive/files/route.ts:71-81` | OneDrive upload POST handler calls both `getAccessToken()` and `graphFetch()` independently — double token acquisition. Also sets Authorization header in both graphFetch internals AND explicit options, risking header conflicts. | Use either graphFetch (handles auth internally) OR raw fetch with manual auth, not both | Double auth call; explicit header conflicts with graphFetch's internal header |

## Medium Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| M1 | frontend | `/dashboard` | Dashboard heading says "Google Workspace" but lists GitHub scopes (repo, workflow, delete:packages) when GitHub profile is active. Wrong template rendered. | Dashboard should match active provider or show provider-appropriate template | Shows "Google Workspace" heading with GitHub scopes, "Unknown user", "0/6 Services Accessible" |
| M2 | frontend | ALL Google pages | Sidebar shows GitHub navigation links (Repos, Organizations, Actions, Gists) instead of Google links when active profile is GitHub. Service context mismatch. | Sidebar navigation should match page context or indicate active service mismatch | GitHub sidebar links shown on Google Workspace pages; sidebar shows "Token invalid" |
| M3 | backend | `src/app/api/audit/apps/route.ts:4-16` | Audit apps route has no try/catch error handling. If `getGoogleAccessToken()` throws (vs returning null), error is uncaught. | Route should have try/catch with serverError() | Static stub response with no error handling wrapper |
| M4 | backend | `src/app/api/audit/delegation/route.ts:4-15` | Audit delegation route has no try/catch error handling. Same issue as M3. | Route should have try/catch with serverError() | Static stub response with no error handling wrapper |
| M5 | backend | `src/app/api/slack/bootstrap/route.ts:1-45` | Slack bootstrap endpoint has no auth check — publicly accessible. Any unauthenticated request can submit a d_cookie and get back a bootstrapped credential. | POST /api/slack/bootstrap should require authentication | No auth check; endpoint open to abuse for token extraction |

## Low Issues

| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| L1 | frontend | `/audit` sidebar | Audit Dashboard content shows Google data correctly but sidebar shows GitHub audit links (/github-audit/*) instead of Google audit links (/audit/*) when GitHub profile is active | Sidebar should show Google audit nav when on /audit path | Shows GitHub audit links (Members, Repo Access, Branch Protections, etc.) |
| L2 | frontend | `/alerts` | Alerts page renders without sidebar and mode toggle bar, breaking structural consistency with all other pages | Same sidebar + header + content layout as other pages | No sidebar, no mode toggle (Operate/Audit/Collect/Studio) |
| L3 | backend | `src/app/api/microsoft/audit/resource-pivot/route.ts:79-82` | DevOps probe URL uses `app.vscode.dev` instead of `dev.azure.com`. The canonical Azure DevOps REST API is at `dev.azure.com/{org}/_apis/`. Resource scope should be `499b84ac-1321-427f-aa17-267ca6975798/.default`. | Probe Azure DevOps at correct API endpoint | Probes app.vscode.dev which is VS Code web editor, not Azure DevOps API |
| L4 | backend | ALL Google API routes (~40 routes) | All Google routes call `serverError(error)` without provider ID, while Microsoft/Slack/GitHub routes properly pass provider ID (e.g., `serverError(error, "microsoft")`). Works due to legacy fallback but inconsistent. | `serverError(error, "google")` for consistent provider-specific error parsing | `serverError(error)` — relies on legacy fallback |
| L5 | backend | `src/lib/slack.ts:219`, `src/lib/microsoft.ts:218`, `src/lib/github.ts:55` | All three API client libraries have unbounded recursive retry on HTTP 429. Could cause stack overflow under sustained rate limiting. | Bounded retry count (e.g., max 3 retries) | Recursive retry without max depth |
| L6 | backend | `src/lib/github.ts:4-5` | GitHub rate limit tracking uses module-level variables shared across all requests/users. Concurrent requests with different tokens overwrite each other's rate limit state. | Per-token or per-request rate limit tracking | Global singleton `rateLimitRemaining` and `rateLimitReset` |

## UX Improvement Opportunities

| # | Page | Current Behavior | Suggested Improvement | Impact |
|---|------|-----------------|----------------------|--------|
| UX1 | `/gmail` | Shows "1-50 of 201" pagination alongside "Failed to fetch messages" error | When fetch fails, hide pagination counts or show "Error" instead of stale counts | Medium — misleading data display |

## Pages That Passed With ZERO Issues (29/35)

Landing page, Calendar, Chat, Directory, Buckets, all 13 Google audit pages (users, groups, roles, apps, delegation, devices, policies, marketplace, access-policies, query, admin-reports, alert-center, drive-activity, groups-settings, contacts), all 6 Microsoft audit pages (conditional-access, auth-methods, risky-users, cross-tenant, pivot, foci-pivot), all 6 Studio pages (main, services, scopes, stealth, extraction), Collection.

## Notes
- The M1/M2/L1 sidebar issues are all the same root cause: when a non-Google profile (GitHub) is active and the user navigates to Google route group pages, the sidebar renders the active provider's nav instead of the route group's nav. This is a provider context vs route context mismatch.
- Build passes cleanly with zero errors.
- No merge conflict artifacts found in any rendered page.
- No "undefined", "null", or "[object Object]" data binding errors found.
