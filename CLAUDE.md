@AGENTS.md

## Development Methodology

### Agent Teams
Use specialized agent teams for complex features:
- **Backend agents**: API routes, providers, token storage, server-side logic
- **Frontend/UI agents**: Components, layouts, styling, client-side state
- **Data agents**: Schema design, data flow, caching, IndexedDB
- **Testing agents**: Playwright MCP browser validation, build verification

Agents brainstorm, collaborate, avoid race conditions (no parallel edits to the same file), and validate each other's work. A backend agent's API claim must be verified by a frontend agent rendering the data.

### Testing & Validation
- All UI changes must be validated with Playwright MCP (browser automation)
- Build must pass (`npm run build`) after every significant change
- No feature is done until visually verified in the browser
- Agents must cross-validate: if one agent says something works, another verifies
- **After every significant implementation** (new features, batch work, major refactors): run `/fire_regression` to catch issues, then `/fire_remediation` to fix them. This is mandatory — no implementation is complete without a regression pass.

### Regression & Remediation Commands
- **`/fire_regression`** — Comprehensive hybrid regression test. Launches parallel agents: backend (build, types, API audit) + frontend (Playwright MCP visits every page, checks rendering, errors, console, UX). Produces `REGRESSION_BUGS.md` bug tracker. Run this after every significant change.
- **`/fire_remediation`** — Reads `REGRESSION_BUGS.md`, spawns agent teams to fix bugs in priority order (critical > high > medium > low), merges fixes, runs verification regression. The two commands form a sequential pipeline: regression finds, remediation fixes.
- Both commands are defined in `.claude/commands/` and use agent teams with roles, cross-validation, and Playwright MCP browser testing.

### Worktree & Agent Safety Rules (Lessons Learned)
- **NEVER clean up worktrees until the agent's work is committed, pushed, and PR created.** Worktree cleanup (`git worktree remove`) destroys all uncommitted changes permanently. If an agent finished its code but didn't commit/push, the coordinator MUST commit and push from the worktree BEFORE removing it.
- **After batch agent work: verify every PR exists and every branch was pushed.** Walk through the agent results and confirm each one reports a `PR: <url>`. If an agent completed but didn't create a PR, go into its worktree and do it manually before cleanup.
- **After merging PRs to main: verify merged content exists on disk.** Run `git log --stat` and spot-check that key files are present. Stashed changes and worktree files are NOT in git — only committed+pushed work survives.
- **Parallel browser agents share the same session and will corrupt each other.** NEVER launch multiple Playwright MCP agents simultaneously. Browser testing must be sequential — one agent, one tab, one profile at a time. Profile switching by one agent affects all others.
- **Provider registration checklist for new providers:** After adding API routes + pages for a new provider, verify: (1) `src/lib/providers/{provider}.ts` exists with ServiceProvider implementation, (2) it's imported and registered in `src/lib/providers/index.ts`, (3) helper function exists in `src/app/api/_helpers.ts`, (4) route group `(provider)` has `layout.tsx` + all pages, (5) provider appears as active (not grayed) on landing page.

### Multi-Service Architecture
- Provider abstraction: `src/lib/providers/` — ServiceProvider interface + registry
- Token storage: encrypted IndexedDB (`src/lib/token-store.ts`), server cookie for API routes
- Route groups: `(google)` for Google Workspace, future `(microsoft)`, `(github)`, etc.
- All Google-specific code lives under `src/lib/providers/google.ts` and `src/lib/google.ts`
- API routes use `getTokenFromRequest()` from `src/app/api/_helpers.ts` — never read cookies directly
- Adding a new provider = implement ServiceProvider interface + register in `src/lib/providers/index.ts`
