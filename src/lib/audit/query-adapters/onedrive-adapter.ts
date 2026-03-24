import type { QueryAdapter, QueryResult, QueryResultItem } from "../query-types"

type OneDriveFile = {
  id: string
  name: string
  size?: number
  createdDateTime?: string
  lastModifiedDateTime?: string
  webUrl?: string
  file?: { mimeType?: string }
  folder?: { childCount?: number }
  parentReference?: { path?: string }
}

export const onedriveAdapter: QueryAdapter = {
  service: "onedrive",
  displayName: "OneDrive",

  async execute(query: string, limit = 20): Promise<QueryResult> {
    const start = performance.now()
    // OneDrive search API doesn't have a separate limit param in the existing route,
    // but the route returns up to 50 by default.
    void limit
    try {
      const params = new URLSearchParams({ term: query })
      const res = await fetch(`/api/microsoft/drive/search?${params}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `OneDrive search failed (${res.status})`)
      }

      const json = await res.json()
      const files: OneDriveFile[] = json.files ?? []

      const items: QueryResultItem[] = files.map((file) => ({
        id: file.id,
        service: "onedrive",
        title: file.name,
        snippet: [
          file.file?.mimeType ?? (file.folder ? "Folder" : ""),
          file.size ? `${Math.round(file.size / 1024)}KB` : "",
          file.parentReference?.path?.replace("/drive/root:", "") ?? "",
        ]
          .filter(Boolean)
          .join(" - "),
        url: file.webUrl,
        date: file.lastModifiedDateTime || file.createdDateTime,
        metadata: {
          mimeType: file.file?.mimeType,
          size: file.size,
          isFolder: !!file.folder,
          parentPath: file.parentReference?.path,
        },
      }))

      return {
        service: "onedrive",
        items,
        totalEstimate: items.length,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        service: "onedrive",
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "OneDrive search failed",
        durationMs: Math.round(performance.now() - start),
      }
    }
  },
}
