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

### Multi-Service Architecture
- Provider abstraction: `src/lib/providers/` — ServiceProvider interface + registry
- Token storage: encrypted IndexedDB (`src/lib/token-store.ts`), server cookie for API routes
- Route groups: `(google)` for Google Workspace, future `(microsoft)`, `(github)`, etc.
- All Google-specific code lives under `src/lib/providers/google.ts` and `src/lib/google.ts`
- API routes use `getTokenFromRequest()` from `src/app/api/_helpers.ts` — never read cookies directly
- Adding a new provider = implement ServiceProvider interface + register in `src/lib/providers/index.ts`
