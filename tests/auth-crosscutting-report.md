# Auth & Cross-Cutting Concerns Test Report

**Date:** 2026-03-19
**Target:** http://localhost:4000 (Ninken - Google Workspace data exploration platform)
**Tester:** Automated QA via Claude Code

---

## 1. Auth Auto - GET /api/auth/auto

**Result: PASS**

- Returns `200` with `{"authenticated":true,"tokenFile":"/Users/vinicios/code/ninken/.secrets/token.json"}`
- Successfully reads token from `.secrets/token.json` and sets auth cookies (`ninken_profiles`, `ninken_active_profile`)
- Cookie options are correct: httpOnly, sameSite=lax, path=/, maxAge=30 days

---

## 2. Auth Check - GET /api/auth

**Result: PASS**

- **Without cookies:** Returns `200` with `{"authenticated":false,"profiles":[],"activeProfile":0}` -- correctly reports unauthenticated state without returning an error status
- **With cookies (after /api/auth/auto):** Returns `200` with `{"authenticated":true,"profiles":[{"email":null,"index":0}],"activeProfile":0}`
- **Note:** The `email` field is initially `null` in the cookie. The frontend's `ProfileSelector` component asynchronously fetches the email via `/api/gmail/profile` and patches it in. This is by design but worth noting: the initial auth response always shows `email: null` until the frontend resolves it.

---

## 3. Auth Scopes - GET /api/auth/scopes

**Result: PASS**

- **Without cookies:** Returns `401` with `{"error":"Not authenticated"}` -- correct
- **With cookies:** Returns `200` with a list of 10 granted OAuth scopes:
  - `admin.directory.group.readonly`
  - `admin.directory.user.readonly`
  - `calendar`
  - `cloud-platform`
  - `devstorage.full_control`
  - `drive`
  - `gmail.compose`
  - `gmail.modify`
  - `gmail.readonly`
  - `gmail.send`

---

## 4. Unauthenticated Access - GET /api/gmail/messages

**Result: PASS**

- Without cookies: Returns `401` with `{"error":"Unauthorized"}`
- The proxy middleware (`src/proxy.ts`) intercepts all `/api/*` routes (except `/api/auth*`) and returns 401 if no valid token cookie is present

---

## 5. Invalid Routes - GET /api/nonexistent

**Result: PASS (with note)**

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| `/api/nonexistent` (no cookies) | `401` | `{"error":"Unauthorized"}` |
| `/api/nonexistent` (with cookies) | `404` | Next.js 404 page |
| `/nonexistent` (page route) | `404` | Next.js 404 page |

- **Note:** Without cookies, invalid API routes return 401 (from proxy middleware) rather than 404. This is acceptable behavior -- it avoids leaking route existence to unauthenticated users. With cookies, the correct 404 is returned.

---

## 6. Page Loads

### 6a. Landing Page - http://localhost:4000/

**Result: PASS**

- When authenticated: redirects to `/gmail` (HTTP 307) -- correct behavior per proxy middleware
- When unauthenticated: serves landing page (HTTP 200)
- No console errors

### 6b. Gmail - http://localhost:4000/gmail

**Result: PASS**

- Loads full inbox with 50 messages (paginated, "1-50 of 201")
- Sidebar with labels, search bar, compose button all render correctly
- No console errors

### 6c. Drive - http://localhost:4000/drive

**Result: PASS**

- Loads "My Drive" file listing with folders and files
- Breadcrumb navigation, search, upload button, sort/view toggle all present
- File metadata (owner, modified date, size) displays correctly
- No console errors

### 6d. Buckets - http://localhost:4000/buckets

**Result: PASS**

- Loads GCS bucket explorer with heading "Explorer"
- Large list of buckets with sub-buckets renders correctly
- No console errors

### 6e. Calendar - http://localhost:4000/calendar

**Result: PASS**

- Loads weekly calendar view for March 2026
- Shows multiple calendars (personal, "Cyber Strategy and Risk Calendar", holiday calendars)
- Events render with correct time slots and titles
- Navigation controls (Previous week, Today, Next week) present
- No console errors

### 6f. Directory - http://localhost:4000/directory

**Result: FAIL**

- Page loads but shows error: **"Failed to load users"** with message **"Bad Request"**
- Root cause: The frontend hook (`src/hooks/use-directory.ts`) calls `/api/directory/users` without a `domain` parameter. The Google Admin SDK `users.list` API requires either `domain` or `customer` parameter -- calling without either returns HTTP 400 "Bad Request".
- When tested with `?domain=questrade.com`, the API returns HTTP 403 "Not Authorized to access this resource/api" (likely a Google Workspace admin permissions issue with the current token).
- The "Groups" tab was not tested but likely has similar issues.
- **Impact:** Directory feature is non-functional.

---

## 7. Cache Indicator

**Result: PASS**

- Cache indicator is visible in the sidebar and updates dynamically
- Observed values during testing:
  - After Gmail load: **404.5 KB**
  - After Buckets load: **455.7 KB**
  - After Calendar/Directory load: **511.6 KB**
- "Clear cache" button is present next to the indicator

---

## 8. Profile Info / Avatar

**Result: PASS**

- `ProfileSelector` component renders in the page header (top-right area)
- Avatar displays initials **"MV"** (derived from `mvpenha@questrade.com`)
- Avatar has `bg-red-700` background with white text
- Dropdown menu functionality is wired up (trigger button with `aria-haspopup="menu"`)
- Email is resolved asynchronously via `/api/gmail/profile` and stored back via `PATCH /api/auth`
- "Sign out" button is present in the sidebar

---

## Summary

| # | Test | Result | Severity |
|---|------|--------|----------|
| 1 | Auth Auto | PASS | -- |
| 2 | Auth Check | PASS | -- |
| 3 | Auth Scopes | PASS | -- |
| 4 | Unauthenticated Access | PASS | -- |
| 5 | Invalid Routes | PASS | -- |
| 6a | Landing Page | PASS | -- |
| 6b | Gmail Page | PASS | -- |
| 6c | Drive Page | PASS | -- |
| 6d | Buckets Page | PASS | -- |
| 6e | Calendar Page | PASS | -- |
| 6f | Directory Page | **FAIL** | High |
| 7 | Cache Indicator | PASS | -- |
| 8 | Profile Info/Avatar | PASS | -- |

### Bugs Found

1. **[HIGH] Directory page fails to load users** (`src/hooks/use-directory.ts` line 64, `src/app/api/directory/users/route.ts`)
   - The API call to Google Admin SDK `users.list` is made without a required `domain` parameter, causing a 400 error.
   - Even with `domain` supplied, returns 403, suggesting the token may lack admin directory permissions despite having the `admin.directory.user.readonly` scope granted.

2. **[MEDIUM] Proxy middleware does not protect /calendar and /directory pages** (`src/proxy.ts` line 28)
   - The middleware only checks `/gmail`, `/drive`, and `/buckets` for authentication.
   - `/calendar` and `/directory` are accessible without authentication (return HTTP 200 to unauthenticated users).
   - The underlying API calls will still fail with 401, but the page shell loads, which is inconsistent with the other protected pages.

3. **[LOW] Auth profile email is initially null** (`src/app/api/auth/auto/route.ts`)
   - When auto-loading the token, the email field in the cookie is null unless the token.json file happens to contain an `email` field.
   - The frontend compensates by fetching the email asynchronously, but there is a brief moment where the avatar shows "?" before resolving to the correct initials.
