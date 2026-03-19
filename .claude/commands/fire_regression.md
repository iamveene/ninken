# Comprehensive Functional Regression Test

You are the **Regression Coordinator**. Orchestrate a full backend + frontend regression. The frontend test MUST be sequential (one provider at a time) because all agents share the same browser session.

**CRITICAL**: The user has tokens loaded for ALL providers (Google Workspace, Microsoft 365, Slack, GitHub). Every service should have data. Empty pages or "no data" responses for services with loaded tokens are BUGS. Reason about every empty state.

## Phase 1: Route Discovery

Launch an Explore agent to map every route (all `page.tsx` and `route.ts` files grouped by provider).

## Phase 2: Backend Regression (background, worktree isolation)

Launch ONE backend agent to:
1. `npm run build` — ZERO errors
2. Grep for merge conflict markers in all .ts/.tsx
3. Verify all providers registered in `src/lib/providers/index.ts`
4. Verify all helper functions exist in `_helpers.ts`
5. Verify all routes have try/catch + serverError with provider ID
6. Report as JSON array

## Phase 3: Frontend Functional Regression (SEQUENTIAL — single agent)

Launch ONE frontend agent that tests ALL providers sequentially. **Do NOT launch multiple frontend agents** — they share the browser session and will interfere with each other.

**IMPORTANT**: Load chrome tools with ToolSearch first. Start with `tabs_context_mcp`, create ONE tab, use it throughout.

### Pre-Test: Auto-Import Tokens from secrets/ Folder

Before testing, ensure all tokens are loaded. If the landing page shows no "Active sessions", import tokens automatically:

1. Navigate to `http://localhost:4000/?add=true`
2. Check if "Active sessions" section exists with loaded profiles
3. If NO profiles loaded, import each credential from `secrets/` folder:
   - **Google**: Read `secrets/google/token.json`, click paste toggle, paste JSON into textarea, click Authenticate, wait for redirect
   - **Microsoft**: Read `secrets/microsoft/token.json`, extract minimal fields `{ platform, refresh_token, client_id, tenant_id, foci }`, navigate back to `/?add=true`, paste, authenticate
   - **GitHub**: Read `secrets/github/pat.json`, paste, authenticate
   - **Slack**: Read `secrets/slack/session.json` — NOTE: Slack d_cookie requires bootstrap. Try import; if it fails with "Missing xoxc_token", skip Slack testing and document as known limitation
4. After importing, navigate to `/?add=true` and verify all available profiles appear in "Active sessions"

### Testing Sequence:

```
0. Auto-import tokens if needed (see above)
1. Test Landing Page (verify active sessions, service buttons)
2. Switch to Google profile → Test ALL Google pages
3. Switch to Microsoft profile → Test ALL Microsoft pages
4. Switch to GitHub profile → Test ALL GitHub pages
5. Switch to Slack profile → Test ALL Slack pages (if token loaded)
6. Test Studio pages (provider-agnostic, any profile)
7. Test Collection + Alerts pages
```

### Profile Switching Procedure:
1. Navigate to `http://localhost:4000/?add=true`
2. Find the target provider's session in "Active sessions" list
3. Click it (use `mcp__claude-in-chrome__computer` with click action on the session button)
4. Wait for redirect to that provider's default route
5. Verify the sidebar shows the correct provider's navigation
6. Only THEN start testing that provider's pages

### For EVERY Page — Deep Functional Checklist:

#### A. Loading & Data
- Navigate to the page
- Read page content (depth 4-5, max_chars 8000)
- **Does real data load?** Messages, files, events, users, repos, channels — actual content, not just headings
- If empty: is it scope-denied (expected) or missing data (BUG)?

#### B. Console Errors
- `read_console_messages` with `onlyErrors: true, clear: true` BETWEEN EVERY PAGE
- ALL console errors are findings (except expected 403s for scope-denied features)

#### C. Interactive Elements (READ-ONLY ONLY)
**CRITICAL — NO DESTRUCTIVE ACTIONS:**
- Do NOT send/compose/reply to emails
- Do NOT delete anything (files, messages, items)
- Do NOT modify labels, folders, or permissions
- Do NOT create/upload files
- Do NOT trash messages
- Do NOT post messages in Teams/Slack/Chat
- DO test all read-only interactions: view messages, browse folders, expand rows, switch tabs, filter, search, export, copy, refresh

**Test every interactive element:**
- **Click every tab** — verify content changes (e.g., Login/Admin/Token/Drive/Mobile on admin-reports, All/Critical/High/Medium/Low on alert-center)
- **Click filter buttons** — verify filtering actually changes the displayed items
- **Type in search bars** — verify results update or filter
- **Click expandable rows** — verify detail panel opens with content
- **Test pagination** — if present, click next/prev and verify data changes
- **Click action buttons**: Export (verify download triggers or menu opens), Refresh (verify reload), Copy (verify no crash)
- **Test mode toggle**: Operate → Audit → Collection → Studio — verify sidebar nav changes for each

#### D. Sidebar Verification (per provider)
- Correct nav items for the active provider (not another provider's nav)
- Click at least 3 sidebar links — verify correct navigation
- Sidebar collapse/expand works
- Active item is highlighted for current page

#### E. Content Reasoning
- **Reason about every piece of visible content** — does it make sense?
- Messages should show subjects, senders, dates — not empty rows
- Files should show names, sizes, types
- Users should show emails, display names
- If you see "0 items" but the token has access to that service → BUG
- If you see raw JSON, stack traces, or "[object Object]" → BUG
- If a scope-denied message appears, check: does the token actually lack that scope? (reference the audit dashboard scope list)

#### F. Collection Testing
- On Gmail/Drive/Buckets/Teams pages: verify "Send to Collection" or collect buttons EXIST on data items (DON'T click them — that's a write action — just verify they're present)
- Navigate to `/collection`: verify page loads with queue controls (Start/Stop/Retry Errors), Export ZIP button, Clear All button, stats display, filter controls
- Reason: if no collected items, that's expected (nothing was collected). The page structure should still be complete.

#### G. Feature-Specific Tests

**Gmail**: Messages load with subjects? Click a message → detail view opens? Label sidebar present? "Send to Collection" button visible on a message?
**Drive**: Files load with names/sizes? Navigate into a folder → breadcrumbs update? "Send to Collection" on files?
**Calendar**: Events or calendars visible? Week navigation (prev/next) works?
**Chat**: Spaces listed? Click a space → messages appear?
**Outlook**: Messages load? Folder sidebar (Inbox/Sent/Drafts) works?
**OneDrive**: Files load? Navigate folders?
**Teams**: Teams listed? Click team → channels? Click channel → messages?
**Entra**: Users/Groups/Roles tabs all load data?
**Collection**: Page structure with queue controls + export + stats?
**FOCI Pivot**: "Start Probe" button present? Click it → results render?
**Resource Pivot**: Probe cards with status? "Re-probe" button works?
**Query**: Query library loads (37+ queries)? Click a query → search runs?
**Admin Reports**: All 5 application tabs switch content?
**Alert Center**: Severity cards clickable? Filter tabs switch content?
**Studio Converter**: FOCI client list renders? NO hydration errors?

### Provider-Specific Page Lists:

#### Landing Page
- `/?add=true` — Active sessions (all 4 providers), service buttons (Google/Microsoft/Slack/GitHub active, AWS grayed), paste toggle, drag-drop zone

#### Google Workspace (switch to Google first!)
`/gmail`, `/drive`, `/calendar`, `/chat`, `/directory`, `/buckets`, `/dashboard`,
`/audit`, `/audit/users`, `/audit/groups`, `/audit/roles`, `/audit/apps`, `/audit/delegation`, `/audit/devices`, `/audit/policies`, `/audit/marketplace`, `/audit/access-policies`, `/audit/query`, `/audit/admin-reports`, `/audit/alert-center`, `/audit/drive-activity`, `/audit/groups-settings`, `/audit/contacts`

#### Microsoft 365 (switch to Microsoft first!)
`/outlook`, `/onedrive`, `/teams`, `/entra`, `/m365-dashboard`,
`/m365-audit`, `/m365-audit/users`, `/m365-audit/groups`, `/m365-audit/roles`, `/m365-audit/apps`, `/m365-audit/sign-ins`, `/m365-audit/conditional-access`, `/m365-audit/risky-users`, `/m365-audit/auth-methods`, `/m365-audit/cross-tenant`, `/m365-audit/pivot`, `/m365-audit/foci-pivot`, `/m365-audit/query`

#### GitHub (switch to GitHub first!)
`/github-dashboard`, `/repos`, `/orgs`, `/actions`, `/gists`,
`/github-audit`, `/github-audit/members`, `/github-audit/repo-access`, `/github-audit/branch-protections`, `/github-audit/webhooks`, `/github-audit/deploy-keys`, `/github-audit/apps`, `/github-audit/actions-security`, `/github-audit/secrets`, `/github-audit/dependabot`, `/github-audit/code-scanning`

#### Slack (switch to Slack first!)
`/slack-dashboard`, `/channels`, `/slack-files`, `/slack-users`

#### Studio (any profile)
`/studio`, `/studio/services`, `/studio/scopes`, `/studio/stealth`, `/studio/extraction`, `/studio/converter`

#### Other (any profile)
`/collection`, `/alerts`

## Phase 4: Bug Tracker

Compile ALL findings into `REGRESSION_BUGS.md`:

```markdown
# Regression Bug Tracker — {date}

## Summary
- Total issues: N
- Critical: N | High: N | Medium: N | Low: N | UX: N
- Backend: N | Frontend: N
- Functional failures: N

## Functional Test Results
| Provider | Page | Data Loads | Tabs/Filters | Search | Actions | Console Errors | Status |
|----------|------|-----------|-------------|--------|---------|---------------|--------|

## Critical Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|

## High Issues
(same table)

## Medium Issues
(same table)

## Low Issues
(same table)

## UX Improvements
| # | Page | Current | Suggested | Impact |
|---|------|---------|-----------|--------|
```

Severity:
- **Critical**: Crashes, data not loading with valid token, build failures
- **High**: Console errors, broken interactions, wrong data, broken navigation
- **Medium**: Inconsistent UX, partial functionality, misleading messages
- **Low**: Minor styling, cosmetic
- **UX**: Improvement opportunities

## Phase 5: Summary

Print: total issues, functional pass rate, top 3 critical, recommendation for `/fire_remediation`.

## Execution Notes
- Backend agent: use `isolation: "worktree"`
- Frontend agent: SINGLE agent, SEQUENTIAL testing, ONE browser tab
- **Switch profile BEFORE testing each provider** — this is non-negotiable
- Clear console errors between every page
- The bug tracker is the deliverable — must be comprehensive and actionable
- Do NOT fix bugs — document only
