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

### Testing Sequence:

```
1. Test Landing Page (no profile switch needed)
2. Switch to Google profile → Test ALL Google pages
3. Switch to Microsoft profile → Test ALL Microsoft pages
4. Switch to GitHub profile → Test ALL GitHub pages
5. Switch to Slack profile → Test ALL Slack pages
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

#### C. Interactive Elements
- **Click every tab** — verify content changes
- **Click filter buttons** — verify filtering works
- **Type in search bars** — verify results update
- **Click expandable rows** — verify detail opens
- **Test pagination** — if present, click next/prev
- **Click action buttons**: Export, Refresh, Copy, Send to Collection, Start Probe
- **Test mode toggle**: Operate → Audit → Collection → Studio

#### D. Sidebar Verification (per provider)
- Correct nav items for the active provider
- Click at least 3 sidebar links — verify navigation
- Sidebar collapse/expand works
- Active item is highlighted

#### E. Feature-Specific Tests

**Gmail**: Send to Collection button on a message? Compose dialog opens?
**Drive**: Context menu on a file? Share dialog? Breadcrumbs update on folder navigation?
**Calendar**: Week navigation (prev/next)? Event detail on click?
**Outlook**: Folder switching? Message read/unread toggle?
**Teams**: Team → channel → messages drill-down?
**Collection**: Queue Start/Stop buttons work? Export ZIP button? Item cards render?
**FOCI Pivot**: Click "Start Probe" → does it actually run and show results?
**Resource Pivot**: Click "Re-probe" → does it refresh?
**Query**: Select a query from library → does search execute?

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
