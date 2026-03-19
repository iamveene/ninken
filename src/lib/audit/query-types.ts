/**
 * Audit Query types — cross-service intelligence search for red team operations.
 */

export type ServiceId =
  | "gmail"
  | "drive"
  | "calendar"
  | "buckets"
  | "outlook"
  | "onedrive"

/** A single search result item from any service. */
export type QueryResultItem = {
  id: string
  service: ServiceId
  title: string
  snippet: string
  url?: string
  date?: string
  metadata: Record<string, unknown>
}

/** Result from a single service query. */
export type QueryResult = {
  service: ServiceId
  items: QueryResultItem[]
  totalEstimate: number
  error?: string
  durationMs: number
}

/** Aggregated results across all queried services. */
export type AggregatedResults = {
  query: string
  results: QueryResult[]
  totalItems: number
  totalDurationMs: number
  completedAt: string
}

/** Category for organizing pre-built queries. */
export type QueryCategory =
  | "credentials"
  | "api-keys"
  | "infrastructure"
  | "pii"
  | "internal-access"
  | "security"
  | "recon"
  | "exfiltration"

/** A pre-built red team query definition. */
export type PrebuiltQuery = {
  id: string
  name: string
  description: string
  category: QueryCategory
  /** The raw search query string — may contain service-specific syntax. */
  query: string
  /** Which services this query targets. Empty = all applicable. */
  services: ServiceId[]
  /** Severity/risk indicator for findings. */
  severity: "critical" | "high" | "medium" | "low" | "info"
  /** Tags for filtering in the UI. */
  tags: string[]
}

/** Query execution status per service. */
export type ServiceQueryStatus = {
  service: ServiceId
  status: "idle" | "loading" | "success" | "error"
  error?: string
}

/** History entry stored in localStorage. */
export type QueryHistoryEntry = {
  id: string
  query: string
  prebuiltId?: string
  services: ServiceId[]
  totalResults: number
  executedAt: string
}

/** Adapter interface for service-specific search translation. */
export type QueryAdapter = {
  service: ServiceId
  displayName: string
  /** Translate a generic query string into the service's search API call. */
  execute: (query: string, limit?: number) => Promise<QueryResult>
}
