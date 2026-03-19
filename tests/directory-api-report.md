# Directory API Test Report

**Date:** 2026-03-19
**Base URL:** `http://localhost:4000`
**Auth method:** Cookie-based via `/api/auth/auto`

---

## Summary

All four Directory API endpoints were tested. **Two critical bugs** were found: the users and groups list endpoints always fail with HTTP 500 because they require a `customer` or `domain` parameter for the Google Admin SDK, but the API does not provide a default `customer` value. Additionally, the `serverError` helper does not map Google API 400 errors correctly, returning 500 instead of 400.

| Endpoint | Status | Verdict |
|---|---|---|
| `GET /api/directory/users` | 500 (broken) | FAIL |
| `GET /api/directory/users/{id}` | 404 (correct for unknown ID) | PASS (with caveats) |
| `GET /api/directory/groups` | 500 (broken) | FAIL |
| `GET /api/directory/groups/{id}/members` | 404 (correct for unknown ID) | PASS (with caveats) |

---

## 1. Users List -- `GET /api/directory/users`

### Request (no params)
```
curl -b cookies.txt http://localhost:4000/api/directory/users
```

### Result
- **HTTP Status:** 500
- **Response:** `{"error":"Bad Request"}`
- **Expected shape (per code):** `{ users: DirectoryUser[], nextPageToken: string | null }`
- **Root cause:** Google Admin SDK `admin.users.list()` requires either `customer` or `domain` parameter. The route only passes `domain` from query params. When omitted, Google returns "Bad Request".

### Supported query params (per code)
| Param | Type | Default | Notes |
|---|---|---|---|
| `query` | string | undefined | Search filter |
| `domain` | string | undefined | Google Workspace domain |
| `maxResults` | number | 50 | Capped at 500 |
| `pageToken` | string | undefined | Pagination token |

### Sub-tests

| Test | Status | Response |
|---|---|---|
| No params | 500 | `{"error":"Bad Request"}` |
| `?query=test` (no domain) | 500 | `{"error":"Bad Request"}` |
| `?domain=` (empty) | 500 | `{"error":"Bad Request"}` |
| `?domain=ninken.com.br` | 404 | `{"error":"Domain not found."}` |
| `?domain=test.com&maxResults=-1` | 500 | `{"error":"Invalid value '-1'..."}` |
| `?domain=test.com&maxResults=0` | 403 | `{"error":"Not Authorized..."}` |
| `?domain=test.com&maxResults=999` | 403 | `{"error":"Not Authorized..."}` (capped to 500 correctly) |
| `?domain=test.com&maxResults=abc` | 403 | Defaults to 50 correctly |
| No auth cookie | 401 | `{"error":"Unauthorized"}` |
| POST method | 405 | (empty body) |

### Bugs found
1. **[CRITICAL] Missing `customer` default:** When no `domain` is provided, the route should default to `customer: "my_customer"` so Google Admin SDK knows which directory to query. Without this, the endpoint is completely non-functional for the default use case (the UI calls it without a domain).
2. **[MEDIUM] `maxResults` has no lower bound:** `Math.min(Number(val) || 50, 500)` allows negative values like `-1` to pass through. Should add `Math.max(1, ...)`.
3. **[MEDIUM] Google 400 errors mapped to HTTP 500:** The `serverError` helper only handles 404 and 403 from Google. A 400 "Bad Request" from Google is returned as HTTP 500, misleading clients.

---

## 2. User Detail -- `GET /api/directory/users/{id}`

### Request
```
curl -b cookies.txt http://localhost:4000/api/directory/users/fake-user-id
```

### Result
- **HTTP Status:** 404
- **Response:** `{"error":"Resource Not Found: userKey"}`
- **Expected shape (per code):** Full `DirectoryUser` object (Google Admin SDK user resource with `projection: "full"`)

### Sub-tests

| Test | Status | Response |
|---|---|---|
| `fake-user-id` | 404 | `{"error":"Resource Not Found: userKey"}` |
| No auth cookie | 401 | `{"error":"Unauthorized"}` |
| DELETE method | 405 | (empty body) |

### Notes
- Could not test with a valid user ID because the users list endpoint is broken (no way to discover real user IDs).
- Error handling correctly maps Google 404 to HTTP 404.
- Auth gate works properly.

---

## 3. Groups List -- `GET /api/directory/groups`

### Request (no params)
```
curl -b cookies.txt http://localhost:4000/api/directory/groups
```

### Result
- **HTTP Status:** 500
- **Response:** `{"error":"Bad Request"}`
- **Expected shape (per code):** `{ groups: DirectoryGroup[], nextPageToken: string | null }`
- **Root cause:** Same as users list -- Google Admin SDK `admin.groups.list()` requires either `customer` or `domain`.

### Supported query params (per code)
| Param | Type | Default | Notes |
|---|---|---|---|
| `query` | string | undefined | Search filter |
| `domain` | string | undefined | Google Workspace domain |
| `maxResults` | number | 50 | Capped at 200 |
| `pageToken` | string | undefined | Pagination token |

### Sub-tests

| Test | Status | Response |
|---|---|---|
| No params | 500 | `{"error":"Bad Request"}` |
| `?query=test` (no domain) | 500 | `{"error":"Bad Request"}` |
| `?domain=ninken.com.br` | 404 | `{"error":"Domain not found."}` |
| No auth cookie | 401 | `{"error":"Unauthorized"}` |

### Bugs found
1. **[CRITICAL] Same missing `customer` default as users list.** The `groups.list()` call needs either `customer` or `domain`.
2. **[MEDIUM] Same `maxResults` lower bound issue** as users list (allows negative values).

---

## 4. Group Members -- `GET /api/directory/groups/{id}/members`

### Request
```
curl -b cookies.txt http://localhost:4000/api/directory/groups/fake-group-id/members
```

### Result
- **HTTP Status:** 404
- **Response:** `{"error":"Resource Not Found: groupKey"}`
- **Expected shape (per code):** `{ members: GroupMember[], nextPageToken: string | null }`

### Sub-tests

| Test | Status | Response |
|---|---|---|
| `fake-group-id` | 404 | `{"error":"Resource Not Found: groupKey"}` |
| No auth cookie | 401 | `{"error":"Unauthorized"}` |

### Notes
- Could not test with a valid group ID because the groups list endpoint is broken.
- Error handling correctly maps Google 404 to HTTP 404.
- Auth gate works properly.
- `maxResults` is hardcoded to 200 (not user-configurable), avoiding the validation bug.

---

## Cross-cutting Observations

### Authentication
All four endpoints correctly return `{"error":"Unauthorized"}` with HTTP 401 when no auth cookie is provided. The `getTokenFromRequest()` + `unauthorized()` guard works properly.

### Method enforcement
Non-GET methods (POST, DELETE) correctly return HTTP 405 Method Not Allowed.

### Error handling (`serverError` helper)
The helper at `src/app/api/_helpers.ts` only maps Google API error codes 404 and 403. Google 400 ("Bad Request") errors fall through to the generic handler and are returned as HTTP 500. This is misleading -- a 400 from Google should be returned as 400 to the client.

### Frontend impact
The `useUsers` and `useGroups` hooks in `src/hooks/use-directory.ts` call these endpoints **without** a `domain` parameter. This means the Directory page in the UI (`/directory`) will always show an error state for both the People and Groups tabs.

### Data quality
Unable to assess data quality because the list endpoints are broken and no valid user/group IDs could be obtained for detail endpoints.

---

## Recommended Fixes

1. **Add `customer: "my_customer"` default** in both `users/route.ts` and `groups/route.ts` when no `domain` is provided:
   ```ts
   const res = await admin.users.list({
     customer: domain ? undefined : "my_customer",
     domain,
     // ...
   })
   ```

2. **Add lower bound to `maxResults`** validation:
   ```ts
   const maxResults = Math.min(Math.max(1, Number(searchParams.get("maxResults")) || 50), 500)
   ```

3. **Handle Google 400 errors** in the `serverError` helper:
   ```ts
   if (apiError.code === 400) {
     return NextResponse.json(
       { error: apiError.message || "Bad Request" },
       { status: 400 }
     )
   }
   ```
