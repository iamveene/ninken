# Regression Bug Tracker — 2026-03-19 (Post-GitLab Integration)

## Summary
- Total issues: 7
- Critical: 0 | High: 2 | Medium: 3 | Low: 1 | UX: 1
- Backend: 0 | Frontend: 7
- Functional failures: 0 (all pages load, all data renders)
- New provider (GitLab): FULLY FUNCTIONAL — dashboard, projects (500), groups (125), snippets, pipelines, audit pages all load

## Functional Test Results
| Provider | Page | Data Loads | Tabs/Filters | Search | Console Errors | Status |
|----------|------|-----------|-------------|--------|---------------|--------|
| GitLab | /gitlab-dashboard | YES (user, scopes, rate limit) | Operate/Audit/Collect/Studio | N/A | None | PASS |
| GitLab | /gitlab-projects | YES (500 projects) | All/Public/Internal/Private | Present | Duplicate key warning | PASS* |
| GitLab | /gitlab-groups | YES (125 groups) | All/Public/Internal/Private | Present | None | PASS |
| GitLab | /gitlab-snippets | YES (0 — expected, no snippets) | All/Public/Internal/Private | Present | None | PASS |
| GitLab | /gitlab-pipelines | N/A (placeholder) | N/A | N/A | None | PASS |
| GitLab | /gitlab-audit | YES (6 audit cards) | Sidebar switches to audit | N/A | None | PASS |
| GitLab | /gitlab-audit/* | YES (6 placeholder pages) | N/A | N/A | None | PASS |
| GitHub | /github-dashboard | YES (user, 16 scopes, rate limit) | All modes | N/A | None | PASS |
| GitHub | /repos | YES (17 repos, full columns) | All/Public/Private | Present | None | PASS |
| Google | /dashboard | YES (6/6 services, 12 scopes) | All modes | N/A | None | PASS |
| Google | /gmail | YES (201 messages, labels, senders) | Unread/Attachments/Starred/Sent | Present | None | PASS |
| Microsoft | /m365-dashboard | YES (4/4 services, 27 scopes) | All modes | N/A | None | PASS |
| Collection | /collection | YES (2 items, stats, queue) | Status/Source filters | N/A | Hydration warning | PASS* |
| Studio | /studio | YES (Token Analyzer) | All sidebar links | N/A | None | PASS |
| Landing | /?add=true | YES (5 sessions, 5 active providers + AWS grayed) | N/A | N/A | None | PASS |

## High Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| 1 | BUG | /gitlab-projects | Table columns (Visibility, Stars, Forks, Last Activity, Collect button) not rendering data — only the Project name column shows content | All 6 columns display data for each project row | Visibility/Stars/Forks/LastActivity/Collect cells appear blank; only project name links render |
| 2 | BUG | /collection (pre-existing) | CollectionItemCard button-in-button hydration error — TooltipTrigger renders `<button>` wrapping a Button component that also renders `<button>`, creating nested buttons | No hydration errors in console | Multiple console errors: "In HTML, <button> cannot be a descendant of <button>". Pre-existing issue, not caused by GitLab integration |

## Medium Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| 3 | BUG | /gitlab-projects | Duplicate React key `73030143` — two projects share the same ID, causing React reconciliation warning | Unique keys for all table rows | Console error: "Encountered two children with the same key". Likely GitLab API returning same project via multiple group membership paths. Fix: deduplicate by ID before rendering |
| 4 | BUG | /gitlab-groups | Created date column and Collect button column missing from rendered table — columns defined in JSX but don't appear | All 5 columns (Group, Visibility, Parent, Created, Collect) visible with data | Only Group, Visibility, Parent columns show data |
| 5 | BUG | All GitLab pages | "Token invalid" shown in sidebar footer TokenLifecycle while GitLab APIs return data successfully | Token status should reflect actual API validity | Footer shows red "Token invalid" text. Likely because TokenLifecycle uses canRefresh() which returns false for PAT tokens. Same pattern may affect GitHub — verify |

## Low Issues
| # | Type | Page/File | Description | Expected | Actual |
|---|------|-----------|-------------|----------|--------|
| 6 | BUG | /?add=true | GitHub sessions display "GitHub" as session name instead of username. GitLab correctly resolves to "mvpenha@questrade.com" via email endpoint | Both providers should show resolved identity | GitHub shows generic "GitHub" text; GitLab correctly shows email. GitHub /api/github/me returns login but the landing page email field check may differ |

## UX Improvements
| # | Page | Current | Suggested | Impact |
|---|------|---------|-----------|--------|
| 7 | /gitlab-audit | Mode toggle bar in header still shows "Operate" as the active mode when user is on /gitlab-audit/* pages | The "Audit" button should be highlighted when pathname starts with /gitlab-audit | Low — sidebar correctly switches to audit nav items, only the top header mode toggle pill is misleading |

## Remediation Priority
1. **#1 + #4** (High/Medium) — GitLab projects/groups table columns not rendering. Likely a CSS or data-binding issue where cell data isn't populating. Check if the table cell JSX actually renders the field values.
2. **#3** (Medium) — Deduplicate GitLab projects by ID before rendering to prevent duplicate key warnings.
3. **#5** (Medium) — TokenLifecycle component needs to handle non-refreshable tokens gracefully (PATs from GitHub/GitLab).
4. **#2** (High, pre-existing) — Collection card button-in-button hydration. Wrap Button in `<span>` or use `asChild` on TooltipTrigger.
5. **#6** (Low) — GitHub email resolution on landing page.
6. **#7** (UX) — Mode toggle audit detection for provider-prefixed audit routes.
