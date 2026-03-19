# GCP Buckets API Test Report

**Date:** 2026-03-19
**Base URL:** http://localhost:4000
**Auth:** Cookie-based via `/api/auth/auto`

---

## 1. Projects List

**Endpoint:** `GET /api/gcp/projects`
**Status:** 200 OK

| Field | Type | Description |
|-------|------|-------------|
| `projects` | array | List of GCP projects |
| `projects[].projectId` | string | e.g. `"accbookkeeping-firestore-sit"` |
| `projects[].name` | string | e.g. `"projects/1092672930192"` |
| `projects[].displayName` | string | Same as projectId |
| `projects[].state` | string | e.g. `"ACTIVE"` |
| `projects[].accessible` | boolean | Whether current user can access buckets |
| `projects[].bucketCount` | number | Number of buckets in the project |

**Result:** PASS -- 323 projects returned. Shape is correct. Both accessible (`true`) and inaccessible (`false`) projects appear in the list.

---

## 2. Buckets for Project

**Endpoint:** `GET /api/gcp/buckets?project={projectId}`
**Status:** 200 OK

| Field | Type | Description |
|-------|------|-------------|
| `buckets` | array | List of buckets in the project |
| `buckets[].name` | string | Bucket name |
| `buckets[].location` | string | e.g. `"US-EAST1"` |
| `buckets[].storageClass` | string | e.g. `"STANDARD"` |
| `buckets[].timeCreated` | string | ISO timestamp |
| `buckets[].hasObjects` | boolean | Whether the bucket has any objects |
| `buckets[].readable` | boolean | Whether user can list objects |
| `buckets[].downloadable` | boolean | Whether user can download objects |

**Result:** PASS -- Tested with `accbookkeeping-firestore-sit` (2 buckets) and `qt-nonprod-etf-factsheet-0a` (6 buckets). The `readable` and `downloadable` flags are present on all bucket entries.

### Edge Cases

| Test | Status | Response |
|------|--------|----------|
| Missing `project` param | 400 | `{"error":"Missing required query parameter: project"}` |
| Non-accessible project | 403 | `{"error":"Request is prohibited by organization's policy..."}` |
| Unauthenticated request | 401 | `{"error":"Unauthorized"}` |

---

## 3. Objects in Bucket

**Endpoint:** `GET /api/gcp/buckets/{name}/objects`
**Status:** 200 OK

| Field | Type | Description |
|-------|------|-------------|
| `objects` | array | List of GCS objects at current level |
| `objects[].name` | string | Full object path |
| `objects[].size` | string | Size in bytes |
| `objects[].contentType` | string | MIME type |
| `objects[].timeCreated` | string | ISO timestamp |
| `objects[].md5Hash` | string | MD5 hash |
| `prefixes` | array | Sub-folder prefixes for navigation |
| `canDownload` | boolean | Whether user can download objects |

**Result:** PASS -- Tested with `accbookkeeping-firestore-sit.appspot.com` (0 objects, 1 prefix) and `etf-factsheet-store-bucket-dev-d20d` (3 objects, 2 prefixes).

### Edge Cases

| Test | Status | Response |
|------|--------|----------|
| Non-existent bucket | 404 | `{"error":"The specified bucket does not exist."}` |

---

## 4. Objects with Prefix (Folder Navigation)

**Endpoint:** `GET /api/gcp/buckets/{name}/objects?prefix={prefix}`
**Status:** 200 OK

**Result:** PASS -- Navigating into `assets/` prefix in `etf-factsheet-store-bucket-dev-d20d` correctly returned 1 object (`assets/gcp-logo.svg`) and 0 sub-prefixes. The prefix-based navigation works correctly for hierarchical browsing.

---

## 5. Object Metadata

**Endpoint:** `GET /api/gcp/buckets/{name}/objects/metadata?path={path}`

### Accessible bucket (downloadable=true)

**Status:** 200 OK

Returns full GCS object metadata including `kind`, `name`, `bucket`, `contentType`, `size`, `md5Hash`, `timeCreated`, `updated`, etc.

**Result:** PASS -- Tested with `etf-factsheet-store-bucket-dev-d20d/slice.json`.

### Non-accessible bucket (downloadable=false)

**Status:** 403

```json
{"error":"mvpenha@questrade.com does not have storage.objects.get access..."}
```

**Result:** PASS -- Access correctly denied.

### Edge Cases

| Test | Status | Response |
|------|--------|----------|
| Non-existent object | 404 | `{"error":"No such object: ..."}` |
| Missing `path` param | 400 | `{"error":"Missing required query parameter: path"}` |

---

## 6. Object Download

**Endpoint:** `GET /api/gcp/buckets/{name}/objects/download?path={path}`

### Accessible bucket (downloadable=true)

**Status:** 200 OK

Response headers:
- `Content-Disposition: attachment; filename="slice.json"`
- `Content-Type: application/octet-stream`
- `Content-Length: 23`

**Result:** PASS -- File downloaded correctly with proper headers.

### Non-accessible bucket (downloadable=false)

**Status:** 403

Returns HTML error page: "Access Denied - You don't have permission to download this file."

**Result:** PASS -- Access correctly denied with user-friendly error page.

### Edge Cases

| Test | Status | Response |
|------|--------|----------|
| Non-existent object | 404 | HTML page: "Not Found - The requested file was not found." |
| Missing `path` param | 400 | `{"error":"Missing required query parameter: path"}` |

---

## 7. Bucket IAM

**Endpoint:** `GET /api/gcp/buckets/{name}/iam`
**Status:** 200 OK

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | `"storage#policy"` |
| `resourceId` | string | Bucket resource path |
| `version` | number | IAM policy version |
| `etag` | string | Policy etag |
| `bindings` | array | IAM role bindings |
| `bindings[].role` | string | IAM role |
| `bindings[].members` | array | Members with this role |

**Result:** PASS -- Tested with both accessible and non-accessible buckets. Returns full IAM policy with role bindings.

### Edge Cases

| Test | Status | Response |
|------|--------|----------|
| Non-existent bucket | 404 | `{"error":"The specified bucket does not exist."}` |

---

## 8. Access Control Flags Verification

### Bucket-level flags (`readable`, `downloadable`)

**Result:** PASS -- Both flags are present on every bucket object in the response. Observed combinations:
- `readable=true, downloadable=true` (e.g. `etf-factsheet-store-bucket-dev-d20d`)
- `readable=true, downloadable=false` (e.g. `accbookkeeping-firestore-sit.appspot.com`)

### Object-level flag (`canDownload`)

**Result:** PASS with caveat (see Bug #1 below) -- The `canDownload` flag is present on all objects listing responses.

---

## 9. Bugs Found

### Bug #1: `canDownload` incorrectly defaults to `true` when no objects at root level

**Severity:** Medium
**Location:** `src/app/api/gcp/buckets/[name]/objects/route.ts` (lines 33-41)

**Description:** The `canDownload` flag defaults to `true` and is only checked against the first object in the response. When the root-level listing of a non-downloadable bucket returns only prefixes (folders) and zero objects, `canDownload` is returned as `true` because there are no objects to test against.

**Reproduction:**
1. List objects at root for `accbookkeeping-firestore-sit.appspot.com` (bucket-level `downloadable=false`)
2. Root response: `canDownload=true` (INCORRECT -- 0 objects, 1 prefix)
3. Navigate into prefix `2024-12-02T18:10:05_34783/`: `canDownload=false` (correct -- 1 object present to test)

**Same behavior confirmed with** `qt-dbbackup-bucket`:
- Root: `canDownload=true` (INCORRECT -- 0 objects, 3 prefixes)
- With prefix `non-production/`: `canDownload=false` (correct)

**Root cause:** The check on line 34 (`if (objects.length > 0)`) skips permission testing when no objects exist, leaving the default `true` value.

**Suggested fix:** When no objects exist in the response, either:
- Default `canDownload` to `false` instead of `true`, or
- Perform a test against an object from a sub-prefix, or
- Use the bucket-level `downloadable` flag to set the initial value

---

## Summary

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 1 | `GET /api/gcp/projects` | 200 | PASS |
| 2 | `GET /api/gcp/buckets?project={id}` | 200 | PASS |
| 3 | `GET /api/gcp/buckets/{name}/objects` | 200 | PASS |
| 4 | `GET /api/gcp/buckets/{name}/objects?prefix={p}` | 200 | PASS |
| 5 | `GET /api/gcp/buckets/{name}/objects/metadata?path={p}` | 200/403 | PASS |
| 6 | `GET /api/gcp/buckets/{name}/objects/download?path={p}` | 200/403 | PASS |
| 7 | `GET /api/gcp/buckets/{name}/iam` | 200 | PASS |
| 8 | `readable` + `downloadable` flags on buckets | -- | PASS |
| 9 | `canDownload` flag on objects | -- | PASS (with bug) |

**Overall:** 8/9 tests fully passing, 1 test passing with a medium-severity bug (`canDownload` defaults to `true` when no objects exist at the current prefix level).

**Error handling** is solid across all endpoints -- proper 400 for missing params, 401 for unauthenticated, 403 for forbidden, 404 for not found.
