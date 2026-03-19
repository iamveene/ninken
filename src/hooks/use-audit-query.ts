"use client"

import { useState, useCallback, useRef } from "react"
import type {
  ServiceId,
  AggregatedResults,
  ServiceQueryStatus,
  QueryHistoryEntry,
  PrebuiltQuery,
} from "@/lib/audit/query-types"
import { executeQuery } from "@/lib/audit/query-engine"

const HISTORY_KEY = "ninken:audit-query-history"
const MAX_HISTORY = 50

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadHistory(): QueryHistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as QueryHistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(entries: QueryHistoryEntry[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
  } catch {
    // localStorage full or unavailable
  }
}

export function useAuditQuery(defaultServices: ServiceId[]) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AggregatedResults | null>(null)
  const [serviceStatuses, setServiceStatuses] = useState<ServiceQueryStatus[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [history, setHistory] = useState<QueryHistoryEntry[]>(loadHistory)
  const abortRef = useRef<AbortController | null>(null)

  const execute = useCallback(
    async (
      searchQuery: string,
      services?: ServiceId[],
      prebuiltId?: string
    ) => {
      if (!searchQuery.trim()) return

      // Abort any in-flight query
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const targetServices = services ?? defaultServices
      setQuery(searchQuery)
      setIsExecuting(true)
      setResults(null)
      setServiceStatuses(
        targetServices.map((s) => ({ service: s, status: "loading" }))
      )

      try {
        const aggregated = await executeQuery(searchQuery, targetServices, {
          limit: 25,
          signal: controller.signal,
          onProgress: (_serviceResult, allStatuses) => {
            setServiceStatuses([...allStatuses])
          },
        })

        if (!controller.signal.aborted) {
          setResults(aggregated)

          // Save to history
          const entry: QueryHistoryEntry = {
            id: generateId(),
            query: searchQuery,
            prebuiltId,
            services: targetServices,
            totalResults: aggregated.totalItems,
            executedAt: aggregated.completedAt,
          }
          setHistory((prev) => {
            const updated = [entry, ...prev.filter((h) => h.query !== searchQuery)].slice(0, MAX_HISTORY)
            saveHistory(updated)
            return updated
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          // Set all services to error
          setServiceStatuses(
            targetServices.map((s) => ({
              service: s,
              status: "error" as const,
              error: error instanceof Error ? error.message : "Query execution failed",
            }))
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsExecuting(false)
        }
      }
    },
    [defaultServices]
  )

  const executePrebuilt = useCallback(
    async (prebuilt: PrebuiltQuery) => {
      const services = prebuilt.services.length > 0
        ? prebuilt.services.filter((s) => defaultServices.includes(s))
        : defaultServices
      await execute(prebuilt.query, services, prebuilt.id)
    },
    [execute, defaultServices]
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setIsExecuting(false)
  }, [])

  const clearResults = useCallback(() => {
    setResults(null)
    setServiceStatuses([])
    setQuery("")
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  const removeHistoryEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      saveHistory(updated)
      return updated
    })
  }, [])

  return {
    query,
    setQuery,
    results,
    serviceStatuses,
    isExecuting,
    history,
    execute,
    executePrebuilt,
    abort,
    clearResults,
    clearHistory,
    removeHistoryEntry,
  }
}
