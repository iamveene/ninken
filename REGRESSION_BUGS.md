# Regression Bug Tracker — 2026-03-19 (Post Repo Tree Feature)

## Summary
- Total issues: 1
- Critical: 0 | High: 0 | Medium: 1 | Low: 0 | UX: 0
- Backend: 0 | Frontend: 1
- GitLab repo tree drill-down: FULLY FUNCTIONAL

## Functional Test Results
| Provider | Page | Data Loads | Console Errors | Status |
|----------|------|-----------|---------------|--------|
| Landing | /?add=true | 3 sessions (Google, Slack, GitLab) | None | PASS |
| GitLab | /gitlab-dashboard | mvpenha, 4/5 services, 5 scopes, 1989 rate limit | None | PASS |
| GitLab | /gitlab-projects | 500 projects, all columns, internal links + external links | None | PASS |
| GitLab | /gitlab-projects/[id] (tree root) | Folders + files listed, branch selector, breadcrumbs | Base UI warnings | PASS |
| GitLab | /gitlab-projects/[id]?path=cfg (subfolder) | Subfolder contents: custom_chart/ + YAML files | None | PASS |
| GitLab | /gitlab-projects/[id]?file=cfg/envvars.yaml | File content displayed, 313 B, collect + open in GitLab | None | PASS |
| Google | /gmail | 201 messages, labels, subjects | None | PASS |
| Google | /drive | Files + folders with grid view | None | PASS |
| Microsoft | /m365-dashboard | 4/4 services, 27 scopes | None | PASS |
| Microsoft | /outlook | 25 messages, folder sidebar | None | PASS |
| Collection | /collection | 2 items, zero hydration errors | None | PASS |
| Studio | /studio | Token Analyzer | None | PASS |

## Repo Tree Drill-Down Feature Verification
| Test | Result |
|------|--------|
| Projects list links internally to /gitlab-projects/[id] | PASS |
| External link icon opens GitLab in new tab | PASS |
| Branch selector with correct default branch (master/dev/main) | PASS |
| Root directory shows folders first, then files alphabetically | PASS |
| Click folder → navigates deeper, breadcrumb updates | PASS |
| Click file → file viewer opens with decoded content | PASS |
| File viewer shows filename, size, path, content | PASS |
| Collect button on EVERY folder | PASS |
| Collect button on EVERY file | PASS |
| Collect button in file viewer | PASS |
| "Open in GitLab" link in file viewer | PASS |
| Close button dismisses file viewer | PASS |
| URL params shareable (?path=X&ref=Y&file=Z) | PASS |
| Breadcrumb navigation back to parent folders | PASS |

## Medium Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| 1 | BUG | /gitlab-projects/[id] | Base UI warning: "A component that acts as a button..." — the Select/combobox branch selector triggers Base UI accessibility warnings about button behavior | No console warnings | 2 Base UI warnings about button semantics in the Select combobox. Non-breaking — functional behavior is correct. Pre-existing pattern from shadcn/ui Select component. |
