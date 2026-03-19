# Comprehensive Hybrid Regression Test

You are the **Regression Coordinator**. Your job is to orchestrate a full backend + frontend regression test of the Ninken platform, document all findings, and produce an actionable bug tracker.

## Phase 1: Route Discovery

Launch an Explore agent to map every route in the application:
- Scan `src/app/` recursively for all `page.tsx` files
- Scan `src/app/api/` recursively for all `route.ts` files
- Build a complete list of frontend pages and API endpoints
- Group by route group: `(google)`, `(microsoft)`, `(studio)`, `(slack)`, root

## Phase 2: Backend Regression (parallel)

Launch a backend regression agent (in background):

1. **Build Check**: Run `npm run build` — capture ALL warnings and errors
2. **TypeScript Check**: Run `npx tsc --noEmit` if available — capture type errors
3. **API Route Audit**: For each API route file:
   - Read the file
   - Check for: missing error handling, unhandled promise rejections, missing auth checks (`getGoogleAccessToken`/`getMicrosoftCredential`/`unauthorized()`), hardcoded values, missing imports
   - Check consistency: all Google routes use `getGoogleAccessToken()`, all Microsoft routes use `getMicrosoftCredential()`
4. **Dependency Check**: Look for unused imports, circular dependencies, missing packages
5. Report all findings with severity (critical/high/medium/low) and file:line references

## Phase 3: Frontend Regression (parallel with Phase 2)

Launch a frontend regression agent that uses **Playwright MCP (claude-in-chrome)** browser automation:

**IMPORTANT**: Load chrome tools with ToolSearch before using them. Start with `tabs_context_mcp`, create a new tab, then test systematically.

For EVERY page discovered in Phase 1, the agent must:

### 3a. Page Loading & Rendering
- Navigate to the page via `mcp__claude-in-chrome__navigate`
- Wait for content to load (check that skeleton/loading states resolve)
- Read the page with `mcp__claude-in-chrome__read_page` — verify the page has meaningful content (not blank, not just an error)
- Check page title is "Ninken" (not a Next.js error page)

### 3b. Error Detection
- Use `mcp__claude-in-chrome__read_console_messages` with `onlyErrors: true` to capture:
  - JavaScript exceptions
  - React hydration errors
  - Failed network requests (4xx/5xx that aren't expected 403s)
  - Merge conflict markers in rendered content
  - Module not found errors
- Clear console between pages to avoid cross-contamination

### 3c. Content Validation
- Verify page heading exists and matches expected content
- Check that the sidebar navigation renders with correct links
- Verify mode toggle (Operate/Audit/Collect/Studio) is present
- Check for "undefined", "null", "[object Object]" rendered as text (data binding errors)
- Check for empty states that should have data vs expected empty states

### 3d. Structure & UX Analysis
- Verify consistent layout: sidebar + header + content area
- Check that interactive elements (buttons, tabs, filters) are present where expected
- Look for accessibility issues: missing button labels, unlabeled inputs
- Check for responsive layout issues (overflow, clipping)
- Verify dark mode styling consistency (no white flashes, proper color tokens)

### 3e. Scope-Denied UX Review
- For audit pages showing "scope denied" / "permission required" messages:
  - Verify the message is helpful (explains what scope is needed)
  - Verify no raw error JSON is shown to the user
  - Verify the page still has proper structure (header, nav, export button)
  - Flag pages where the error UX could be improved

### 3f. Cross-Page Consistency
- Verify all audit pages follow the same layout pattern
- Check that export buttons are present on data pages
- Verify filter tabs/search bars are consistent in style
- Check that scope indicator banners use consistent colors (green/amber/red)

## Phase 4: Bug Tracker Generation

After both agents complete, compile ALL findings into a structured bug tracker at `REGRESSION_BUGS.md`:

```markdown
# Regression Bug Tracker — {date}

## Summary
- Total issues: N
- Critical: N | High: N | Medium: N | Low: N | UX: N
- Backend issues: N | Frontend issues: N

## Critical Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|

## High Issues
(same table format)

## Medium Issues
(same table format)

## Low Issues
(same table format)

## UX Improvement Opportunities
| # | Page | Current Behavior | Suggested Improvement | Impact |
|---|------|-----------------|----------------------|--------|
```

Severity guide:
- **Critical**: Build failures, crashes, merge conflict markers in code, broken auth
- **High**: Console errors, missing error handling, data not loading, broken navigation
- **Medium**: Inconsistent UX, missing accessibility, cosmetic issues
- **Low**: Minor styling, improvement suggestions
- **UX**: Not bugs — opportunities for better user experience

## Phase 5: Summary Report

Print a concise summary to the user:
- Total issues found by category
- Top 3 most critical issues
- Pages that passed with no issues
- Recommendation: whether `/fire_remediation` should be run

## Execution Notes

- Use `isolation: "worktree"` for backend agents to avoid interfering with the running dev server
- Frontend agent needs the dev server running on port 4000 — check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000` first, start it if not running
- All agents should work in parallel where possible
- The bug tracker file is the primary deliverable — it must be comprehensive and actionable
- Do NOT fix any bugs — only document them. Fixes are done by `/fire_remediation`
