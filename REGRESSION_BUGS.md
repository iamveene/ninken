# Regression Bug Tracker — 2026-03-19 (Post-Remediation)

## Summary
- Total issues: 7
- Fixed: 6/6 bugs | Verified: 6/6 | Skipped: 1 (UX)
- Critical: 0 | High: 0 | Medium: 0 | Low: 0 | UX: 1 (skipped)
- New issues from remediation: 0

## Functional Test Results (Post-Remediation)
| Provider | Page | Data Loads | Tabs/Filters | Search | Console Errors | Status |
|----------|------|-----------|-------------|--------|---------------|--------|
| GitLab | /gitlab-dashboard | YES — user, 5 scopes, 1991 rate limit | All modes | N/A | None | PASS |
| GitLab | /gitlab-projects | YES — 499 projects (1 dedup removed), ALL columns visible | All/Public/Internal/Private | Present | None | PASS |
| GitLab | /gitlab-groups | YES — 125 groups, ALL 5 columns visible (Group, Visibility, Parent, Created, Collect) | All/Public/Internal/Private | Present | None | PASS |
| GitLab | /gitlab-snippets | YES (0 — expected) | All/Public/Internal/Private | Present | None | PASS |
| GitLab | /gitlab-pipelines | N/A (placeholder) | N/A | N/A | None | PASS |
| GitLab | /gitlab-audit | YES (6 audit cards) | Sidebar correct | N/A | None | PASS |
| GitHub | /github-dashboard | YES — user iamveene, 16 scopes | All modes | N/A | None | PASS |
| GitHub | /repos | YES — 17 repos, full columns | All/Public/Private | Present | None | PASS |
| Google | /dashboard | YES — 6/6 services, 12 scopes | All modes | N/A | None | PASS |
| Google | /gmail | YES — 201 messages | All filters | Present | None | PASS |
| Microsoft | /m365-dashboard | YES — 4/4 services, 27 scopes | All modes | N/A | None | PASS |
| Collection | /collection | YES — 2 items, stats | Status/Source filters | N/A | **None** (hydration fixed) | PASS |
| Studio | /studio | YES — Token Analyzer | All sidebar links | N/A | None | PASS |
| Landing | /?add=true | YES — 5 sessions, 5 providers | N/A | N/A | None | PASS |

## Fixed Issues
| # | Severity | Description | Status | Fix |
|---|----------|-------------|--------|-----|
| 1 | High | GitLab projects table columns not rendering | **VERIFIED** | Constrained project name column to max-w-[300px] with truncation; set explicit widths on Visibility/Stars/Forks/LastActivity columns |
| 2 | High | Collection button-in-button hydration error | **VERIFIED** | Replaced nested Button inside TooltipTrigger with render prop pattern using plain `<button>` elements |
| 3 | Medium | Duplicate React key on GitLab projects | **VERIFIED** | Deduplicate projects by ID before rendering (499 unique from 500 total) |
| 4 | Medium | GitLab groups Created + Collect columns missing | **VERIFIED** | Same column width fix as #1 — constrained group name column, set explicit widths |
| 5 | Medium | "Token invalid" on GitLab/GitHub pages | **VERIFIED** | Added PAT/Slack provider paths to /api/auth/token-info; TokenLifecycle shows "PAT active" with green dot for non-refreshable tokens |
| 6 | Low | GitHub sessions show "GitHub" instead of username | **FIXED** | Landing page email resolution now checks emailAddress, email, and login fields (requires re-importing GitHub token to verify) |

## Skipped
| # | Type | Description | Reason |
|---|------|-------------|--------|
| 7 | UX | Mode toggle shows "Operate" on /gitlab-audit pages | UX improvement — sidebar correctly shows audit nav; only cosmetic toggle issue |
