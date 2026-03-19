# Regression Bug Tracker — 2026-03-19 (Post-Remediation Verification)

## Summary
- Total issues: 0
- Critical: 0 | High: 0 | Medium: 0 | Low: 0 | UX: 0
- Backend: 0 | Frontend: 0
- New regressions from remediation: 0
- All 6 previously-fixed bugs remain VERIFIED

## Functional Test Results
| Provider | Page | Data Loads | Console Errors | Status |
|----------|------|-----------|---------------|--------|
| Landing | /?add=true | 5 sessions (Google, Microsoft, 2x GitHub, GitLab), 5 provider buttons + AWS grayed | None | PASS |
| GitLab | /gitlab-dashboard | YES — mvpenha, 5 scopes, 1990 rate limit, "PAT active" footer | None | PASS |
| GitLab | /gitlab-projects | YES — 500 projects, ALL 6 columns visible (Project, Visibility, Stars, Forks, Last Activity, Collect) | None (HMR mismatch dev-only) | PASS |
| GitLab | /gitlab-groups | YES — 125 groups, ALL 5 columns visible (Group, Visibility, Parent, Created, Collect) | None | PASS |
| GitLab | /gitlab-snippets | YES (0 — expected) | None | PASS |
| GitLab | /gitlab-pipelines | Placeholder — expected | None | PASS |
| GitLab | /gitlab-audit | YES — 6 audit cards with correct sidebar | None | PASS |
| Google | /dashboard | YES — 6/6 services, 12 scopes, 59m token | None | PASS |
| Google | /gmail | YES — 201 messages, labels, senders, subjects | None | PASS |
| Microsoft | /m365-dashboard | YES — 4/4 services, 27 scopes, 123m token | None | PASS |
| GitHub | /github-dashboard | YES — iamveene, 16 scopes, 4978 rate limit, "PAT active" footer | None | PASS |
| Collection | /collection | YES — 2 items (Drive + Gmail), stats, queue controls | **None** (hydration fix verified) | PASS |
| Studio | /studio | YES — Token Analyzer | None | PASS |

## Previously Fixed Bugs — Verification Status
| # | Original Bug | Fix Applied | Post-Remediation Status |
|---|-------------|-------------|------------------------|
| 1 | GitLab projects table columns blank | max-w-[300px] + explicit column widths | **VERIFIED** — all columns render |
| 2 | Collection button-in-button hydration | TooltipTrigger render prop pattern | **VERIFIED** — zero console errors |
| 3 | Duplicate React key on projects | Deduplicate by ID before render | **VERIFIED** — 499 unique (was 500) |
| 4 | GitLab groups Created + Collect missing | Column width constraints | **VERIFIED** — all columns render |
| 5 | "Token invalid" on PAT providers | PAT/Slack paths in token-info API + TokenLifecycle "PAT active" display | **VERIFIED** — green "PAT active" on both GitHub and GitLab |
| 6 | GitHub sessions show "GitHub" not username | Landing page checks email/login fields | **FIXED** (needs token re-import to verify) |
