"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type SecurityAlert = {
  alertId: string
  type: string
  source: string
  createTime: string
  severity: "critical" | "high" | "medium" | "low"
  deleted: boolean
  data: Record<string, unknown>
}

type AlertCenterResult = {
  alerts: SecurityAlert[]
  nextPageToken: string | null
  scope: "granted" | "denied"
}

export function useAuditAlertCenter() {
  const fetcher = useCallback(async (): Promise<AlertCenterResult> => {
    const res = await fetch("/api/audit/alert-center?pageSize=50")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(
        data.error || `Failed to fetch alerts (${res.status})`
      )
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } =
    useCachedQuery<AlertCenterResult>("audit:alert-center", fetcher, {
      ttlMs: CACHE_TTL_LIST,
    })

  return {
    alerts: data?.alerts ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    scope: data?.scope ?? "granted",
    loading,
    error,
    refetch,
  }
}
