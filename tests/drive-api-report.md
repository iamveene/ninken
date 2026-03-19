# Drive API Endpoint Test Report

**Date:** 2026-03-19
**Base URL:** http://localhost:4000
**Auth:** Auto-login via `/api/auth/auto` (cookie-based)

---

## Test Results Summary

| # | Endpoint | Method | Status | Verdict |
|---|----------|--------|--------|---------|
| 1 | `/api/drive/files` | GET | 200 | PASS |
| 2 | `/api/drive/files?folderId={id}` | GET | 200 | PASS (see note) |
| 3 | `/api/drive/search?q=test` | GET | 400 | FAIL - wrong param name |
| 3b| `/api/drive/search?term=test` | GET | 200 | PASS |
| 4 | `/api/drive/files/{id}` | GET | 200 | PASS |
| 5 | `/api/drive/files/{id}/download` | GET | 200 | PASS |
| 6 | `/api/drive/shared-drives` | GET | 200 | PASS |
| 7 | `/api/drive/files/{id}/permissions` | GET | 200 | PASS |
| 8 | `/api/drive/files/{id}/copy` | POST | 200 | PASS (with body) |
| 8b| `/api/drive/files/{id}/copy` | POST | 500 | FAIL (no body) |
| 9 | `/api/drive/files/mkdir` | POST | 200 | PASS |

---

## Detailed Findings

### 1. Files List - GET /api/drive/files

- **Status:** 200
- **Response shape:** `{ files: [...], nextPageToken: string }`
- **Key fields per file:** `id`, `name`, `mimeType`, `starred`, `webViewLink`, `iconLink`, `thumbnailLink`, `createdTime`, `modifiedTime`, `shared`, `size`, `owners[]`, `parents[]`
- **Data quality:** Good. Returns 20 files sorted by most recently modified. Includes folders, documents, spreadsheets, presentations, PDFs, and plain text files. Pagination is supported via `nextPageToken`.
- **Notes:** Owner objects are fully populated with `displayName`, `emailAddress`, `photoLink`, `permissionId`, and `me` boolean. Some files lack `parents` (shared files from other users) while owned files include it.

### 2. Files in Folder - GET /api/drive/files?folderId={id}

- **Status:** 200
- **Folder tested:** `1RoFBBeSKRr2UUDbcMPFfZimAOWnnENHE` ("Bucket Investigation")
- **Response shape:** Same as files list: `{ files: [...], nextPageToken: string }`
- **Data quality:** Good. Returns files visible to the user including the folder itself and its children. Pagination token present.
- **Issue:** The response includes the folder itself as the first item in the `files` array, plus ALL files from the user's drive (not just files inside the folder). The `folderId` parameter does NOT appear to filter results to only the contents of that folder -- it returns the same 20 files as the root listing. This is a **potential bug**: either the parameter is ignored, or the API lists "recently modified files accessible from that folder context" rather than strict folder contents.

### 3. Search - GET /api/drive/search?q=test

- **Status:** 400
- **Error response:** `{ "error": "Missing required query parameter: term" }`
- **Issue:** The search endpoint expects the query parameter to be named `term`, NOT `q`. This is a discoverability/documentation issue -- `q` is the conventional name for search queries.

#### 3b. Search (corrected) - GET /api/drive/search?term=test

- **Status:** 200
- **Response shape:** `{ files: [...], nextPageToken: string }`
- **Data quality:** Good. Returned 20 files matching "test" in their names (e.g., `TESTING_GUIDE.md`, `test-output.txt`, `iconMapper.test.ts`, etc.). Results are relevant and well-structured, same schema as the files list.

### 4. File Details - GET /api/drive/files/{id}

- **Status:** 200
- **File tested:** `11S5-dNVvf295MinzVnvtEl3RRRpb99y8` (playwright-test-1773882421971.txt)
- **Response shape:** Single file object (not wrapped in array)
- **Key fields:** `id`, `name`, `mimeType`, `starred`, `parents`, `webViewLink`, `iconLink`, `thumbnailLink`, `createdTime`, `modifiedTime`, `owners[]`, `shared`, `permissions[]`, `size`
- **Data quality:** Excellent. Includes full permission details with `permissionDetails[]` sub-array showing `permissionType`, `role`, and `inherited` flag. More detailed than the list endpoint.
- **Notes:** The detail endpoint returns `permissions[]` inline, making the separate permissions endpoint somewhat redundant for single-file lookups.

### 5. File Download - GET /api/drive/files/{id}/download

- **Status:** 200
- **File tested:** `11S5-dNVvf295MinzVnvtEl3RRRpb99y8` (text/plain, 46 bytes)
- **Response body:** `Hello from Playwright E2E test - 1773882421971`
- **Data quality:** Perfect. Returns raw file content directly.
- **Notes:** Successfully downloads the actual file content. Did not test with Google Docs native formats (Docs, Sheets) which would require export conversion.

### 6. Shared Drives - GET /api/drive/shared-drives

- **Status:** 200
- **Response shape:** `{ drives: [...] }`
- **Key fields per drive:** `id`, `name`, `colorRgb`, `backgroundImageLink`, `createdTime`
- **Data quality:** Good. Returns 5 shared drives. Each has a display name, color theme, and background image URL.
- **Notes:** No pagination token returned, suggesting all shared drives fit in a single page (or pagination is not supported for this endpoint).

### 7. File Permissions - GET /api/drive/files/{id}/permissions

- **Status:** 200
- **File tested:** `11S5-dNVvf295MinzVnvtEl3RRRpb99y8`
- **Response shape:** `{ permissions: [...] }`
- **Key fields per permission:** `id`, `type`, `emailAddress`, `role`, `displayName`
- **Data quality:** Good. Returns 1 permission (owner). Simpler response than the inline permissions in file details endpoint (missing `permissionDetails[]`, `photoLink`, `deleted`, `pendingOwner`).

### 8. File Copy - POST /api/drive/files/{id}/copy

- **Without body:** Status 500, error `{ "error": "Unexpected end of JSON input" }` -- the endpoint crashes when no JSON body is provided. This should return a 400 with a descriptive error message instead.
- **With body `{"name":"copy-test"}`:** Status 200
- **Response shape:** `{ id, name, mimeType, webViewLink, modifiedTime, size }`
- **Data quality:** Good. Successfully created a copy of the file with the custom name. Returns the new file's metadata.
- **Issue:** The 500 error on empty body is a bug. The endpoint should validate input and return a 400 status with a helpful error message.

### 9. Create Folder - POST /api/drive/files/mkdir

- **Status:** 200
- **Body sent:** `{ "name": "test-folder", "parentId": "root" }`
- **Response shape:** `{ id, name, mimeType, webViewLink, modifiedTime }`
- **Data quality:** Good. Successfully created a folder with `mimeType: "application/vnd.google-apps.folder"`.
- **Notes:** Returns a Drive web link for immediate access. Folder was cleaned up after test (DELETE returned `{ "success": true }` with 200).

---

## Issues Found

### Bugs

1. **[BUG] File Copy crashes on empty body (500 Internal Server Error)**
   - Endpoint: `POST /api/drive/files/{id}/copy`
   - When no JSON body is sent, the server returns `500` with `"Unexpected end of JSON input"`.
   - Expected: 400 with validation error like `"Missing required field: name"`.
   - Severity: Medium

2. **[BUG] Folder filter (`folderId`) appears to be ignored**
   - Endpoint: `GET /api/drive/files?folderId={id}`
   - The response is identical to the root files listing -- the `folderId` parameter does not filter files to only those within the specified folder.
   - Severity: High -- this breaks folder navigation in the UI.

### Usability Issues

3. **[UX] Search uses `term` instead of conventional `q` parameter**
   - Endpoint: `GET /api/drive/search`
   - The parameter is named `term` rather than the more conventional `q`. The error message when using `q` is clear, but API consumers would expect `q` based on Google Drive API conventions.
   - Severity: Low

---

## Cleanup

All test artifacts (copied file, created folder) were deleted after testing via `DELETE /api/drive/files/{id}`, which returned `{ "success": true }` with status 200.
