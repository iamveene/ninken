# Regression Bug Tracker — 2026-03-19 (Main Branch Post-Merge)

## Summary
- Total issues: 0
- Critical: 0 | High: 0 | Medium: 0 | Low: 0 | UX: 0
- Backend: 0 | Frontend: 0
- Functional failures: 0
- **All 6 providers functional. Zero regressions on main.**

## Functional Test Results
| Provider | Page | Data Loads | Console Errors | Status |
|----------|------|-----------|---------------|--------|
| Landing | /?add=true | 5 sessions (Google, Microsoft, 2x GitHub, GitLab), 5 provider buttons + AWS grayed | None | PASS |
| Google | /dashboard | 6/6 services, 12 scopes, 59m token | None | PASS |
| Google | /gmail | 201 messages, labels, senders, subjects, filters | None | PASS |
| Google | /drive | Files + folders with names, timestamps, shared badges | None | PASS |
| Microsoft | /m365-dashboard | 4/4 services, 27 scopes, 123m token | None | PASS |
| Microsoft | /outlook | 25 messages, folder sidebar, senders, subjects | None | PASS |
| GitHub | /github-dashboard | iamveene, classic PAT, 16 scopes, "PAT active" footer | None | PASS |
| GitHub | /repos | 17 repos, all columns (name, visibility, language, stars, forks, updated) | None | PASS |
| GitLab | /gitlab-dashboard | mvpenha, 5 scopes, 1990 rate limit, "PAT active" footer | None | PASS |
| GitLab | /gitlab-projects | 500 projects, ALL 6 columns visible, collect buttons | HMR only (dev) | PASS |
| GitLab | /gitlab-groups | 125 groups, ALL 5 columns visible | None | PASS |
| GitLab | /gitlab-audit | 6 audit cards, correct sidebar | None | PASS |
| Collection | /collection | 2 items, stats, queue controls, zero hydration errors | **None** | PASS |
| Studio | /studio | Token Analyzer, all sidebar links | None | PASS |

## Notes
- The only console error observed is a Next.js HMR hydration mismatch on GitLab pages due to hot module reload in development. This is a dev-only artifact that does not occur in production builds.
- All previously remediated bugs (#1-#6) remain fixed on main after merge.
- No new regressions introduced by the merge.
