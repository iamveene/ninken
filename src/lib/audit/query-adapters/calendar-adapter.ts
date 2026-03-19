import type { QueryAdapter, QueryResult, QueryResultItem } from "../query-types"

type CalendarEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  htmlLink?: string
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
  organizer?: { email?: string; displayName?: string }
  created?: string
}

export const calendarAdapter: QueryAdapter = {
  service: "calendar",
  displayName: "Google Calendar",

  async execute(query: string, limit = 50): Promise<QueryResult> {
    const start = performance.now()
    try {
      // Calendar API doesn't have a full-text search endpoint like Gmail or Drive.
      // We fetch recent events and filter client-side by the query term.
      const now = new Date()
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

      const params = new URLSearchParams({
        calendarId: "primary",
        timeMin: oneYearAgo.toISOString(),
        timeMax: now.toISOString(),
        maxResults: String(Math.min(limit * 5, 2500)), // Fetch more since we filter client-side
      })
      const res = await fetch(`/api/calendar/events?${params}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Calendar search failed (${res.status})`)
      }

      const json = await res.json()
      const events: CalendarEvent[] = json.events ?? []

      // Client-side filtering
      const lower = query.toLowerCase()
      const terms = lower.split(/\s+OR\s+/i).map((t) => t.trim().toLowerCase())

      const filtered = events.filter((event) => {
        const searchable = [
          event.summary ?? "",
          event.description ?? "",
          event.location ?? "",
          ...(event.attendees?.map((a) => `${a.email ?? ""} ${a.displayName ?? ""}`) ?? []),
          event.organizer?.email ?? "",
        ]
          .join(" ")
          .toLowerCase()

        return terms.some((term) => searchable.includes(term))
      })

      const items: QueryResultItem[] = filtered.slice(0, limit).map((event) => ({
        id: event.id,
        service: "calendar",
        title: event.summary || "(No title)",
        snippet: [
          event.location ?? "",
          event.attendees ? `${event.attendees.length} attendees` : "",
          event.organizer?.email ?? "",
        ]
          .filter(Boolean)
          .join(" - "),
        url: event.htmlLink,
        date: event.start?.dateTime || event.start?.date || event.created,
        metadata: {
          location: event.location,
          attendeeCount: event.attendees?.length ?? 0,
          organizer: event.organizer?.email,
          attendees: event.attendees?.map((a) => a.email).filter(Boolean),
        },
      }))

      return {
        service: "calendar",
        items,
        totalEstimate: filtered.length,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        service: "calendar",
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "Calendar search failed",
        durationMs: Math.round(performance.now() - start),
      }
    }
  },
}
