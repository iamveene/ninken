import type { QueryAdapter, QueryResult, QueryResultItem } from "../query-types"

type OutlookMessage = {
  id: string
  subject?: string
  bodyPreview?: string
  receivedDateTime?: string
  from?: {
    emailAddress?: { address?: string; name?: string }
  }
  webLink?: string
  hasAttachments?: boolean
}

export const outlookAdapter: QueryAdapter = {
  service: "outlook",
  displayName: "Outlook",

  async execute(query: string, limit = 20): Promise<QueryResult> {
    const start = performance.now()
    try {
      const params = new URLSearchParams({
        search: query,
        top: String(limit),
        select: "id,subject,from,receivedDateTime,bodyPreview,hasAttachments,webLink",
      })
      const res = await fetch(`/api/microsoft/mail/messages?${params}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Outlook search failed (${res.status})`)
      }

      const json = await res.json()
      const messages: OutlookMessage[] = json.messages ?? []

      const items: QueryResultItem[] = messages.map((msg) => ({
        id: msg.id,
        service: "outlook",
        title: msg.subject || "(No subject)",
        snippet: msg.bodyPreview ?? "",
        url: msg.webLink,
        date: msg.receivedDateTime,
        metadata: {
          from: msg.from?.emailAddress?.address,
          fromName: msg.from?.emailAddress?.name,
          hasAttachments: msg.hasAttachments,
        },
      }))

      return {
        service: "outlook",
        items,
        totalEstimate: items.length,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        service: "outlook",
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "Outlook search failed",
        durationMs: Math.round(performance.now() - start),
      }
    }
  },
}
