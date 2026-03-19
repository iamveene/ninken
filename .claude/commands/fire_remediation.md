# Remediation Team — Fix Regression Bugs

You are the **Remediation Coordinator**. Your job is to read the regression bug tracker, assemble agent teams to fix issues, validate fixes, and run a verification pass.

## Phase 1: Triage & Planning

1. Read `REGRESSION_BUGS.md` — this is the bug tracker produced by `/fire_regression`
2. If the file doesn't exist or is empty, inform the user to run `/fire_regression` first
3. Group bugs by:
   - **File cluster**: bugs in the same file or related files → same agent
   - **Dependency order**: if bug B depends on fixing bug A first, sequence them
   - **Independence**: bugs in unrelated files can be fixed in parallel
4. Create work units (max 10 agents, combine related bugs per agent)
5. Skip UX improvement items unless the user explicitly asks to include them

## Phase 2: Spawn Fix Agents

For each work unit, launch a background agent with `isolation: "worktree"`:

Each agent receives:
- The specific bugs assigned to it (copied from the tracker with #, severity, file, description)
- Codebase conventions from CLAUDE.md
- Instructions to:
  1. Read the affected files
  2. Fix the bugs
  3. Run `npm run build` to verify
  4. Invoke `skill: "simplify"` to review the fix
  5. Commit with a clear message referencing bug numbers
  6. Push and create a PR with `gh pr create`
  7. Report: `PR: <url>` and list of bugs fixed

**Agent roles within each unit:**
- The agent acts as both **developer** (writes the fix) and **reviewer** (runs simplify, validates the fix doesn't break anything)
- For critical bugs: the agent must read surrounding code to understand the full context before fixing
- For UX bugs: the agent should follow the existing design system (dark mode, red accents, no emojis, shadcn/ui)

## Phase 3: Merge & Integration

After all agents complete:
1. Collect all PRs
2. Merge them to main in dependency order (resolve conflicts if needed)
3. Run `npm run build` on the merged result
4. If build fails, fix merge artifacts

## Phase 4: Verification Regression

After all fixes are merged:
1. Start the dev server if not running
2. Launch a **Verification Agent** using Playwright MCP that:
   - Visits every page that had bugs
   - Verifies the specific bugs are fixed
   - Checks for regressions introduced by the fixes
   - Reads console errors
3. Report: which bugs are verified fixed, which persist, any new issues

## Phase 5: Update Bug Tracker

Update `REGRESSION_BUGS.md`:
- Mark fixed bugs with status "FIXED" and the PR that fixed them
- Mark verified bugs with status "VERIFIED"
- Add any new issues found during verification
- Update the summary counts

## Phase 6: Final Report

Print to the user:
- Bugs fixed: N/M
- Bugs verified: N
- New issues: N (if any)
- PRs created: list with URLs
- Recommendation: re-run `/fire_regression` if new issues were found

## Execution Notes

- Always read REGRESSION_BUGS.md first — never guess at bugs
- Prioritize critical > high > medium > low
- UX improvements are optional unless the user requests them
- Use worktree isolation for all fix agents
- Merge to main only after all agents complete
- The verification pass is mandatory — never skip it
- If a bug can't be fixed without more context, mark it as "NEEDS_INFO" in the tracker
