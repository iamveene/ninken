import type { QueryAdapter, QueryResult, QueryResultItem } from "../query-types"

type DriveFile = {
  id: string
  name: string
  mimeType?: string
  size?: string
  modifiedTime?: string
  createdTime?: string
  webViewLink?: string
  shared?: boolean
  owners?: { displayName?: string; emailAddress?: string }[]
}

export const driveAdapter: QueryAdapter = {
  service: "drive",
  displayName: "Google Drive",

  async execute(query: string, limit = 20): Promise<QueryResult> {
    const start = performance.now()
    try {
      const params = new URLSearchParams({ term: query, limit: String(limit) })
      const res = await fetch(`/api/drive/search?${params}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Drive search failed (${res.status})`)
      }

      const json = await res.json()
      const files: DriveFile[] = json.files ?? []

      const items: QueryResultItem[] = files.map((file) => ({
        id: file.id,
        service: "drive",
        title: file.name,
        snippet: [
          file.mimeType?.replace("application/vnd.google-apps.", "Google ") ?? "",
          file.size ? `${Math.round(Number(file.size) / 1024)}KB` : "",
          file.shared ? "Shared" : "",
          file.owners?.[0]?.emailAddress ?? "",
        ]
          .filter(Boolean)
          .join(" - "),
        url: file.webViewLink,
        date: file.modifiedTime || file.createdTime,
        metadata: {
          mimeType: file.mimeType,
          size: file.size,
          shared: file.shared,
          owners: file.owners,
        },
      }))

      return {
        service: "drive",
        items,
        totalEstimate: items.length,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        service: "drive",
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "Drive search failed",
        durationMs: Math.round(performance.now() - start),
      }
    }
  },
}
