# Comprehensive Functional Regression Test

You are the **Regression Coordinator**. Your job is to orchestrate a DEEP functional regression test — not just page rendering, but actually testing every feature works with real credentials loaded.

**CRITICAL**: The user has tokens loaded for ALL providers (Google Workspace, Microsoft 365, Slack, GitHub). Every service should have data. Empty pages or "no data" responses for services with loaded tokens are BUGS, not expected behavior. Reason about every empty state — is it expected (scope denied) or a bug (data should be there)?

## Phase 1: Route Discovery

Launch an Explore agent to map every route:
- Scan `src/app/` for all `page.tsx` files
- Scan `src/app/api/` for all `route.ts` files
- Group by provider route group

## Phase 2: Backend Regression (parallel)

Launch a backend agent (in background, worktree isolation):

1. **Build Check**: `npm run build` — ZERO errors
2. **API Route Code Audit**: Read every API route file. Check:
   - Auth check present and correct for the provider
   - Error handling (try/catch + serverError)
   - Consistent patterns across routes
   - No dead imports, no merge conflict artifacts
3. **Provider Registration**: Verify every provider with routes/pages is registered in `src/lib/providers/index.ts`
4. **Helper Completeness**: Every provider-specific helper (getGoogleAccessToken, getMicrosoftCredential, getSlackCredential, getGitHubAccessToken) exists in `_helpers.ts`

## Phase 3: Frontend Functional Regression (parallel)

Launch MULTIPLE frontend agents (split by provider) using **Playwright MCP (claude-in-chrome)**. Each agent tests one provider's pages in depth.

**IMPORTANT**: Load chrome tools with ToolSearch first. Start with `tabs_context_mcp`, create a tab, then test.

### Pre-Test: Profile Switching
Before testing each provider, switch to that provider's profile:
- Navigate to `http://localhost:4000/?add=true`
- Click on the session for the target provider in the "Active sessions" list
- Verify redirect to that provider's default route
- If the profile doesn't exist, note it as a blocker

### For EVERY Page — Deep Functional Checklist:

#### A. Loading & Rendering
- Navigate to the page
- Wait for loading states to resolve (no infinite skeletons)
- Read the page content — verify heading, description, layout
- Check page title is "Ninken (忍犬)"

#### B. Console Error Sweep
- `read_console_messages` with `onlyErrors: true, clear: true`
- Flag ALL console errors (except expected 403s for scope-denied features)
- Hydration errors, module errors, type errors are all HIGH severity

#### C. Data Loading Validation (CRITICAL)
- **With a loaded token, does the page show real data?**
- For pages that fetch data: verify actual data content appears (not just headings)
  - Gmail: messages should load (subjects, senders visible)
  - Drive: files should be listed
  - Calendar: events or calendars should appear
  - Outlook: messages should load
  - OneDrive: files should appear
  - Teams: teams/channels should appear
  - Entra: users should be listed
  - GitHub repos: repositories should appear
  - Slack channels: channels should be listed
- If data is empty but the token has access → BUG
- If data shows an error → document the exact error message

#### D. Interactive Element Testing
- **Click every tab** — verify tab content changes
- **Click filter buttons** — verify filter applies (item count changes or table updates)
- **Test search bars** — type a query, verify results filter
- **Test pagination** — if paginated data, click next/prev
- **Click expandable rows** — verify detail panel opens
- **Test mode toggle** — switch between Operate/Audit/Collect/Studio, verify sidebar nav changes
- **Test profile switcher** — switch between profiles, verify page updates

#### E. Sidebar Navigation Functional Test
- Click EVERY sidebar nav link — verify it navigates to the correct page
- Verify the correct sidebar item is highlighted/active for the current page
- Verify sidebar mode (Operate/Audit) shows correct items for the active provider
- Test sidebar collapse/expand toggle

#### F. Scope-Denied vs Real Error
For pages showing "scope denied" / "permission required":
- Is the scope actually missing from the token? (check scopes on the audit dashboard)
- If the token HAS the scope but the page shows denied → BUG
- Is the error message helpful? Does it name the missing scope?
- Is raw JSON or stack trace visible to the user? → BUG

#### G. Button & Action Testing
- Export buttons: click and verify download triggers (or at minimum no error)
- Refresh buttons: click and verify data reloads
- Copy buttons: click and verify (no crash)
- Manual trigger buttons (FOCI Pivot "Start Probe"): click and verify it starts

#### H. Provider Registration & Landing Page
- On `/?add=true`: verify ALL implemented providers show as ACTIVE buttons (not grayed)
- Only unimplemented providers (AWS, GitLab) should be grayed
- Test drag-and-drop zone renders correctly
- Test paste toggle works
- Verify active sessions list shows all loaded profiles

#### I. Cross-Page Consistency
- All audit pages: same layout pattern (heading, description, table/cards)
- Export buttons present on all data pages
- Badge colors consistent (red=critical, amber=high, green=accessible)
- Loading skeletons consistent
- Error components consistent (ServiceError or inline error cards)

### Provider-Specific Functional Tests:

#### Google Workspace
- `/gmail` — Messages load? Label sidebar works? Click a message → detail opens? Compose button works?
- `/drive` — Files load? Navigate into folders? Breadcrumbs work? Search works?
- `/calendar` — Events load? Week navigation works?
- `/chat` — Spaces load? Click a space → messages appear?
- `/directory` — People/Groups tabs work? Search works?
- `/buckets` — Bucket list loads? Click bucket → objects appear?
- `/audit` — Dashboard shows service access grid with green/red indicators? Token info correct?
- `/audit/users` — User list loads? Filters (No 2FA, Admins, Suspended) work?
- `/audit/groups` — Group list loads?
- `/audit/roles` — Roles load?
- `/audit/admin-reports` — Application tabs switch? Time range works?
- `/audit/alert-center` — Severity cards show counts? Filter tabs work?
- `/audit/drive-activity` — Activity list loads? Action filters work?
- `/audit/groups-settings` — Group settings load? Risk badges render?
- `/audit/contacts` — Directory/Contacts/Other tabs load data?
- `/audit/query` — Query library loads (37 queries)? Can execute a search?

#### Microsoft 365
- `/outlook` — Messages load? Folder sidebar works?
- `/onedrive` — Files load?
- `/teams` — Teams load? Click team → channels?
- `/entra` — Users/Groups/Roles tabs work?
- `/m365-audit` — Dashboard shows service grid?
- `/m365-audit/users` — Users load?
- `/m365-audit/groups` — Groups load?
- `/m365-audit/roles` — Roles load?
- `/m365-audit/sign-ins` — Sign-in logs load?
- `/m365-audit/conditional-access` — Policies load? Expand row → structured detail?
- `/m365-audit/risky-users` — Both tabs work (Risky Users + Risk Detections)?
- `/m365-audit/auth-methods` — Auth methods data loads? Aggregate cards show counts?
- `/m365-audit/cross-tenant` — Default policy card renders? Partners table?
- `/m365-audit/pivot` — Resource probe cards render? Re-probe button works?
- `/m365-audit/foci-pivot` — Start probe button works? Results render?

#### GitHub
- `/github-dashboard` — Dashboard loads with token info?
- `/repos` — Repository list loads? Real repos visible?
- `/orgs` — Organizations load?
- `/actions` — Actions data loads?
- `/gists` — Gists load?
- `/github-audit` — Audit dashboard loads?
- All github-audit subpages load and show data?

#### Slack
- `/slack-dashboard` — Dashboard loads?
- `/channels` — Channels load? Click channel → messages?
- `/slack-files` — Files load?
- `/slack-users` — Users load?

#### Studio
- `/studio` — Token analyzer works? Paste a token → results?
- `/studio/services` — Service map loads? Platform tabs filter?
- `/studio/scopes` — Scope calculator works? Buttons toggle?
- `/studio/stealth` — Stealth reference loads? Calculator works?
- `/studio/extraction` — Extraction guide loads? OS filters work?
- `/studio/converter` — FOCI client list renders (NO hydration errors)?

#### Other
- `/collection` — Collection page loads? Queue controls present?
- `/alerts` — Alert center loads?

## Phase 4: Bug Tracker Generation

Compile ALL findings into `REGRESSION_BUGS.md`:

```markdown
# Regression Bug Tracker — {date}

## Summary
- Total issues: N
- Critical: N | High: N | Medium: N | Low: N | UX: N
- Backend issues: N | Frontend issues: N
- Functional failures: N (features that don't work)
- Pages with real data: N/M | Pages with no data: N/M

## Critical Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|

## High Issues
(same table)

## Medium Issues
(same table)

## Low Issues
(same table)

## UX Improvement Opportunities
| # | Page | Current Behavior | Suggested Improvement | Impact |
|---|------|-----------------|----------------------|--------|

## Functional Test Results
| Page | Data Loads | Tabs Work | Search Works | Actions Work | Console Errors | Status |
|------|-----------|-----------|-------------|-------------|---------------|--------|

## Pages That Passed All Tests
(list)
```

Severity guide:
- **Critical**: Crashes, blank pages, build failures, data not loading when token has access
- **High**: Console errors, broken navigation, features that don't respond to clicks, wrong data displayed
- **Medium**: Inconsistent UX, partial functionality, misleading error messages
- **Low**: Minor styling, cosmetic issues
- **UX**: Not bugs — opportunities for improvement

## Phase 5: Summary Report

Print to user:
- Total issues by category
- Functional test pass rate (X/Y pages fully functional)
- Top 3 critical issues
- Recommendation for `/fire_remediation`

## Execution Notes

- Use `isolation: "worktree"` for backend agents
- Frontend agents need dev server on port 4000 — start if not running
- Split frontend testing across MULTIPLE agents (one per provider) for speed
- **Every agent must switch to the correct provider profile before testing that provider's pages**
- The bug tracker is the primary deliverable — must be comprehensive and actionable
- Do NOT fix bugs — only document. Fixes via `/fire_remediation`
- When testing interactive elements, use `mcp__claude-in-chrome__computer` for clicks if `find`/`form_input` aren't sufficient
- Use `mcp__claude-in-chrome__read_network_requests` to check if API calls are actually firing and what they return
