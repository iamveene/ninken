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

### Multi-Service Architecture
- Provider abstraction: `src/lib/providers/` — ServiceProvider interface + registry
- Token storage: encrypted IndexedDB (`src/lib/token-store.ts`), server cookie for API routes
- Route groups: `(google)` for Google Workspace, future `(microsoft)`, `(github)`, etc.
- All Google-specific code lives under `src/lib/providers/google.ts` and `src/lib/google.ts`
- API routes use `getTokenFromRequest()` from `src/app/api/_helpers.ts` — never read cookies directly
- Adding a new provider = implement ServiceProvider interface + register in `src/lib/providers/index.ts`
