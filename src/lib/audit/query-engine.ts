/**
 * Audit Query Engine — parallel search orchestrator with progressive results.
 * Executes queries across multiple services simultaneously and aggregates results.
 */

import type {
  ServiceId,
  QueryResult,
  AggregatedResults,
  ServiceQueryStatus,
} from "./query-types"
import { getAdapter } from "./query-adapters"

export type QueryProgressCallback = (
  serviceResult: QueryResult,
  allStatuses: ServiceQueryStatus[]
) => void

/**
 * Execute a query across multiple services in parallel.
 * Calls the progress callback as each service completes,
 * and returns the final aggregated results.
 */
export async function executeQuery(
  query: string,
  services: ServiceId[],
  options?: {
    limit?: number
    onProgress?: QueryProgressCallback
    signal?: AbortSignal
  }
): Promise<AggregatedResults> {
  const { limit = 20, onProgress, signal } = options ?? {}
  const startTime = performance.now()

  const statuses: ServiceQueryStatus[] = services.map((service) => ({
    service,
    status: "loading",
  }))

  // Notify initial loading state
  if (onProgress) {
    onProgress(
      { service: services[0], items: [], totalEstimate: 0, durationMs: 0 },
      [...statuses]
    )
  }

  const results: QueryResult[] = []

  // Execute all services in parallel
  const promises = services.map(async (service) => {
    if (signal?.aborted) {
      const result: QueryResult = {
        service,
        items: [],
        totalEstimate: 0,
        error: "Aborted",
        durationMs: 0,
      }
      return result
    }

    const adapter = getAdapter(service)
    if (!adapter) {
      const result: QueryResult = {
        service,
        items: [],
        totalEstimate: 0,
        error: `No adapter found for ${service}`,
        durationMs: 0,
      }

      const statusIdx = statuses.findIndex((s) => s.service === service)
      if (statusIdx >= 0) {
        statuses[statusIdx] = { service, status: "error", error: result.error }
      }

      results.push(result)
      onProgress?.(result, [...statuses])
      return result
    }

    try {
      const result = await adapter.execute(query, limit)

      const statusIdx = statuses.findIndex((s) => s.service === service)
      if (statusIdx >= 0) {
        statuses[statusIdx] = result.error
          ? { service, status: "error", error: result.error }
          : { service, status: "success" }
      }

      results.push(result)
      onProgress?.(result, [...statuses])
      return result
    } catch (error) {
      const result: QueryResult = {
        service,
        items: [],
        totalEstimate: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Math.round(performance.now() - startTime),
      }

      const statusIdx = statuses.findIndex((s) => s.service === service)
      if (statusIdx >= 0) {
        statuses[statusIdx] = { service, status: "error", error: result.error }
      }

      results.push(result)
      onProgress?.(result, [...statuses])
      return result
    }
  })

  await Promise.allSettled(promises)

  const totalDurationMs = Math.round(performance.now() - startTime)
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0)

  return {
    query,
    results,
    totalItems,
    totalDurationMs,
    completedAt: new Date().toISOString(),
  }
}
