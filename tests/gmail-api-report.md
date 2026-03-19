# Gmail API Test Report

**Date:** 2026-03-19
**Base URL:** http://localhost:4000
**Authenticated user:** mvpenha@questrade.com

## Summary

7 of 8 endpoints returned **200 OK** with valid data. One endpoint (`GET /api/gmail/drafts/{id}`) returned **405 Method Not Allowed**.

## Endpoint Results

| # | Endpoint | Method | Status | Verdict | Notes |
|---|----------|--------|--------|---------|-------|
| 1 | `/api/gmail/profile` | GET | 200 | PASS | Returns `emailAddress`, `messagesTotal` (15294), `threadsTotal` (10011), `historyId`. All fields populated correctly. |
| 2 | `/api/gmail/labels` | GET | 200 | PASS | Returns `{ labels: [...] }` with 38 labels. Includes both system labels (INBOX, SENT, DRAFT, etc.) and user labels (Projects/*, Jira, DataDog, etc.). Each label has `id`, `name`, `type`, `messagesTotal`, `messagesUnread`, `threadsTotal`, `threadsUnread`. User labels with colors include `color.textColor` and `color.backgroundColor`. |
| 3 | `/api/gmail/messages?q=in:inbox&limit=5` | GET | 200 | PASS | Returns `{ messages: [...], nextPageToken, resultSizeEstimate }`. Returned exactly 5 messages as requested. Each message has: `id`, `threadId`, `labelIds`, `snippet`, `payload` (with `mimeType` and `headers`), `sizeEstimate`, `historyId`, `internalDate`. Pagination token present. |
| 4 | `/api/gmail/search?q=subject:test` | GET | 200 | PASS | Same response shape as messages endpoint. Returned 20 messages (default limit). All messages contain "test" in subject, confirming search works correctly. `nextPageToken` and `resultSizeEstimate` (201) present. |
| 5 | `/api/gmail/threads/{id}` | GET | 200 | PASS | Tested with thread `19c725a019083ddc`. Returns `{ id, historyId, messages: [...] }`. Thread contained 6 messages. Each message includes full payload with all headers (27 headers), `partId`, `filename`, `body`, and nested `parts`. Conversation threading is correct -- all messages share the same `threadId`. |
| 6 | `/api/gmail/messages/{id}` | GET | 200 | PASS | Tested with message `19d03caa7459ba5f`. Returns single message object with full payload. Unlike the list endpoints (which only return `mimeType` and `headers`), the single-message response includes `partId`, `filename`, `body`, and `parts` (3 parts: text/plain, text/x-amp-html, text/html). Full header set (27 headers) including DKIM, SPF, ARC authentication results. |
| 7 | `/api/gmail/drafts` | GET | 200 | PASS | Returns `{ drafts: [...], nextPageToken }`. 4 drafts returned. Each draft has `id` (draft ID, e.g. `r3949934855735863393`) and nested `message` object with full message fields. `nextPageToken` is `null` (no more pages). All drafts have `DRAFT` label. |
| 8 | `/api/gmail/drafts/{id}` | GET | **405** | **FAIL** | Tested with draft `r3949934855735863393`. Returns **405 Method Not Allowed** with empty response body and no Content-Type header. The route likely does not support GET for individual drafts, or the dynamic route handler is missing/misconfigured. |

## Data Quality Assessment

| Check | Result |
|-------|--------|
| Email addresses are valid | Yes -- all From/To addresses are well-formed |
| Dates are reasonable | Yes -- messages span Nov 2025 to Mar 2026 |
| Snippet text is populated | Yes -- all messages have non-empty snippets |
| Label IDs match known labels | Yes -- INBOX, IMPORTANT, CATEGORY_PERSONAL, etc. all present in labels list |
| Pagination tokens work | Yes -- `nextPageToken` present when more results exist, `null` when exhausted |
| Thread grouping is correct | Yes -- thread messages share same `threadId` and are chronologically ordered |
| `internalDate` is epoch ms | Yes -- e.g. `1773885104000` = 2026-03-19 01:51:44 UTC |
| `limit` parameter respected | Yes -- requesting `limit=5` returned exactly 5 messages |

## Issues Found

### 1. `GET /api/gmail/drafts/{id}` returns 405 (HIGH)

**Severity:** High
**Endpoint:** `GET /api/gmail/drafts/r3949934855735863393`
**Expected:** 200 with draft details
**Actual:** 405 Method Not Allowed, empty body

The drafts list endpoint works and returns draft IDs, but fetching an individual draft by its ID fails. This suggests the dynamic route handler for `/api/gmail/drafts/[id]` either does not exist or does not export a GET handler.

### 2. Search default limit differs from messages endpoint (LOW)

**Severity:** Low
**Observation:** `GET /api/gmail/messages?q=in:inbox&limit=5` respected the `limit=5` parameter and returned 5 results. `GET /api/gmail/search?q=subject:test` (with no explicit limit) returned 20 results. The default limit for search appears to be 20. This is not necessarily a bug, but the two endpoints could benefit from consistent default limits.
