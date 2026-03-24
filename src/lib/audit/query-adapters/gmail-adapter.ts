import type { QueryAdapter, QueryResult, QueryResultItem } from "../query-types"

type GmailHeader = { name: string; value: string }

type GmailSearchMessage = {
  id: string
  threadId: string
  snippet?: string
  payload?: {
    headers?: GmailHeader[]
  }
  internalDate?: string
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
}

export const gmailAdapter: QueryAdapter = {
  service: "gmail",
  displayName: "Gmail",

  async execute(query: string, limit = 20): Promise<QueryResult> {
    const start = performance.now()
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) })
      const res = await fetch(`/api/gmail/search?${params}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Gmail search failed (${res.status})`)
      }

      const json = await res.json()
      const messages: GmailSearchMessage[] = json.messages ?? []

      const items: QueryResultItem[] = messages.map((msg) => {
        const headers = msg.payload?.headers
        const subject = getHeader(headers, "Subject")
        const from = getHeader(headers, "From")
        const date = getHeader(headers, "Date")

        return {
          id: msg.id,
          service: "gmail",
          title: subject || "(No subject)",
          snippet: msg.snippet ?? "",
          url: `https://mail.google.com/mail/#all/${msg.id}`,
          date: date || (msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : undefined),
          metadata: {
            from,
            threadId: msg.threadId,
          },
        }
      })

      return {
        service: "gmail",
        items,
        totalEstimate: json.resultSizeEstimate ?? items.length,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        service: "gmail",
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "Gmail search failed",
        durationMs: Math.round(performance.now() - start),
      }
    }
  },
}
