# Calendar API Test Report

**Date:** 2026-03-19
**Base URL:** http://localhost:4000
**Authentication:** Cookie-based via `/api/auth/auto`

---

## 1. GET /api/calendar/calendars

**Status:** 200 OK
**Response Time:** ~0.53s

### Response Shape
```json
{
  "calendars": [ ...CalendarListEntry ]
}
```

### Key Fields per Calendar
| Field | Description |
|-------|-------------|
| `id` | Calendar identifier (email or group ID) |
| `summary` | Calendar name |
| `description` | Optional description |
| `timeZone` | Calendar timezone |
| `accessRole` | `owner` or `reader` |
| `primary` | Boolean, only on primary calendar |
| `colorId`, `backgroundColor`, `foregroundColor` | Color settings |
| `defaultReminders` | Array of reminder objects |
| `conferenceProperties` | Allowed conference types |

### Data Summary
- **5 calendars** returned
- 1 primary calendar (`mvpenha@questrade.com`, access: `owner`)
- 2 shared calendars (Cyber Security Reporting, Cyber Strategy and Risk)
- 2 holiday calendars (Canada, Brazil) with `reader` access
- All calendars include `conferenceProperties` with `hangoutsMeet`

### Issues
- None. Response is clean and well-structured.

---

## 2. GET /api/calendar/events (default, no params)

**Status:** 200 OK
**Response Time:** ~2-3s (large payload, ~484KB)

### Response Shape
```json
{
  "events": [ ...Event ],
  "nextPageToken": "string | null"
}
```

### Key Fields per Event
| Field | Description |
|-------|-------------|
| `id` | Event identifier |
| `summary` | Event title (may be absent) |
| `status` | Always `confirmed` in test data |
| `start` | `{ date }` or `{ dateTime, timeZone }` |
| `end` | `{ date }` or `{ dateTime, timeZone }` |
| `creator` | `{ email, self? }` |
| `organizer` | `{ email, self? }` |
| `attendees` | Array of attendee objects (optional) |
| `hangoutLink` | Google Meet URL (optional) |
| `conferenceData` | Conference details (optional) |
| `recurringEventId` | Parent recurring event ID (optional) |
| `eventType` | `default`, `birthday`, `workingLocation` |
| `htmlLink` | Link to event in Google Calendar |
| `reminders` | Reminder configuration |

### Data Summary
- **250 events** returned (paginated)
- `nextPageToken` is present and populated (pagination works)
- Date range spans from **1976-04-09** (birthday events) to **2023-10-19**
- Event types: `birthday`, `default`, `workingLocation`

### Issues
- **Date range is very broad by default** -- includes recurring birthday events going back to 1976. This may be confusing for users expecting recent events. Consider defaulting to a recent time window.

---

## 3. GET /api/calendar/events?timeMin=...&timeMax=...

**Test Range:** March 1-31, 2026
**Status:** 200 OK
**Response Time:** ~1-2s (~196KB)

### Response Shape
Same as default events endpoint:
```json
{
  "events": [ ...Event ],
  "nextPageToken": null
}
```

### Data Summary
- **120 events** returned for March 2026
- All-day events: **22** (working locations, holidays)
- Timed events: **98**
- Events without summary: **21** (17.5% of events)
- Recurring event instances: **76** (63% of events)
- All events have status `confirmed`
- Event types: `default`, `workingLocation`
- Date range correctly bounded: earliest 2026-03-02, latest 2026-03-31

### Issues
- **BUG: `nextPageToken` key is present with `null` value.** When there are no more pages, the key should either be omitted or the behavior should be documented. Having `nextPageToken: null` in the response could cause clients to incorrectly assume there are more pages to fetch if they only check for key presence.
- **21 events have no `summary` field.** Some of these have attendees (indicating they are real meetings), others do not. This appears to be Google Calendar data where summaries were not set (e.g., focus time blocks).

---

## 4. GET /api/calendar/events/{id}

**Test Event:** `1ed1pquhng4ft3vsv67sn1bi85` (Flexiti - Sleep Country Merchant Integration Testing)
**Status:** 200 OK
**Response Time:** ~0.26s

### Response Shape
Returns the event object directly (NOT wrapped in an envelope):
```json
{
  "kind": "calendar#event",
  "id": "...",
  "summary": "...",
  "start": { "dateTime": "...", "timeZone": "..." },
  "end": { "dateTime": "...", "timeZone": "..." },
  "attendees": [...],
  "conferenceData": {...},
  ...
}
```

### Key Fields
All standard event fields are present: `id`, `summary`, `status`, `start`, `end`, `creator`, `organizer`, `attendees` (7 attendees), `conferenceData`, `hangoutLink`, `reminders`, `eventType`, `htmlLink`, `iCalUID`, `etag`, `created`, `updated`.

### Issues
- **Inconsistent response envelope:** The events list wraps results in `{ "events": [...] }` but the single event endpoint returns the raw event object directly. This is consistent with Google Calendar API behavior, but worth noting for frontend developers.

---

## Edge Case Tests

### Non-existent Event ID
- **Request:** `GET /api/calendar/events/nonexistent-event-id-12345`
- **Status:** 404
- **Response:** `{"error":"Not Found"}`
- **Verdict:** Correct behavior.

### Invalid Date Parameter
- **Request:** `GET /api/calendar/events?timeMin=invalid-date`
- **Status:** 500
- **Response:** `{"error":"Bad Request"}`
- **Verdict: BUG** -- The error message says "Bad Request" but the HTTP status code is **500** (Internal Server Error). This should return **400** (Bad Request) instead. A 500 status indicates a server crash rather than a client input validation error.

### Unauthenticated Request
- **Request:** `GET /api/calendar/calendars` (no cookies)
- **Status:** 401
- **Response:** `{"error":"Unauthorized"}`
- **Verdict:** Correct behavior.

---

## Summary of Findings

| Endpoint | Status | Verdict |
|----------|--------|---------|
| `GET /api/calendar/calendars` | 200 | PASS |
| `GET /api/calendar/events` | 200 | PASS (with notes) |
| `GET /api/calendar/events?timeMin=...&timeMax=...` | 200 | PASS (with notes) |
| `GET /api/calendar/events/{id}` | 200 | PASS |
| `GET /api/calendar/events/{bad-id}` | 404 | PASS |
| `GET /api/calendar/events?timeMin=invalid` | 500 | **FAIL** |
| Unauthenticated request | 401 | PASS |

### Bugs Found

1. **[BUG] Invalid date parameter returns HTTP 500 instead of 400.** When `timeMin=invalid-date` is passed, the server returns `{"error":"Bad Request"}` with status code 500. The status code should be 400 to correctly indicate a client error.

### Observations

2. **[NOTE] `nextPageToken: null` included in response.** When there are no more pages, the response still includes `"nextPageToken": null`. Consider omitting the key entirely when there is no next page, or document this behavior.

3. **[NOTE] Default events list returns very old data.** Without `timeMin`/`timeMax` filters, the events endpoint returns data from as far back as 1976 (birthday events). Consider setting a sensible default time range.

4. **[NOTE] 17.5% of events lack a `summary` field.** This is likely a data quality issue from Google Calendar rather than an API issue, but frontend consumers should handle missing summaries gracefully.

5. **[NOTE] Response envelope inconsistency.** List endpoints wrap data (`{ "calendars": [...] }`, `{ "events": [...] }`), but the single event endpoint returns the raw object. This mirrors the Google Calendar API design but may surprise consumers expecting uniform envelopes.
