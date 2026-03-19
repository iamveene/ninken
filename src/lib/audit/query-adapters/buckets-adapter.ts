import type { QueryAdapter, QueryResult, QueryResultItem } from "../query-types"

export const bucketsAdapter: QueryAdapter = {
  service: "buckets",
  displayName: "GCP Storage",

  async execute(query: string, _limit = 20): Promise<QueryResult> {
    const start = performance.now()
    try {
      // GCP Storage doesn't have a native full-text search API.
      // We need to list buckets first, then search object names within them.
      // Since we don't know the project without additional context,
      // we return an info-level result indicating manual review is needed.

      // Try to get GCP projects from the audit overview first
      const overviewRes = await fetch("/api/audit/overview")
      if (!overviewRes.ok) {
        throw new Error("Cannot access GCP Storage - audit overview unavailable")
      }

      const overview = await overviewRes.json()
      if (!overview.storage?.accessible) {
        return {
          service: "buckets",
          items: [],
          totalEstimate: 0,
          error: "GCP Storage not accessible with current token",
          durationMs: Math.round(performance.now() - start),
        }
      }

      // GCP bucket object listing requires a specific project and bucket name.
      // We can't do full-text search across all buckets efficiently.
      // Return an advisory result.
      const items: QueryResultItem[] = [{
        id: "gcp-storage-advisory",
        service: "buckets",
        title: "GCP Storage search requires manual review",
        snippet: `Query "${query}" cannot be automatically searched across GCP buckets. Use the Buckets browser to manually inspect objects. ${overview.storage.projectCount ?? 0} projects visible.`,
        metadata: {
          projectCount: overview.storage.projectCount,
          advisory: true,
        },
      }]

      return {
        service: "buckets",
        items,
        totalEstimate: 0,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        service: "buckets",
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "GCP Storage search failed",
        durationMs: Math.round(performance.now() - start),
      }
    }
  },
}
