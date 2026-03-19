"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type ReportActivityParameter = {
  name: string
  value: string
}

export type ReportActivity = {
  id: string
  time: string
  actor: string
  ipAddress: string
  eventType: string
  eventName: string
  applicationName: string
  parameters: ReportActivityParameter[]
  regionCode: string
}

type AdminReportsResult = {
  activities: ReportActivity[]
  nextPageToken: string | null
  scope: "full" | "denied"
}

export type ApplicationName = "login" | "admin" | "token" | "drive" | "mobile"

export function useAuditAdminReports(
  application: ApplicationName,
  options?: {
    userKey?: string
    startTime?: string
    endTime?: string
  }
) {
  const userKey = options?.userKey || "all"
  const startTime = options?.startTime
  const endTime = options?.endTime

  const cacheKey = `audit:admin-reports:${application}:${userKey}:${startTime || ""}:${endTime || ""}`

  const fetcher = useCallback(async (): Promise<AdminReportsResult> => {
    const params = new URLSearchParams({ application, userKey })
    if (startTime) params.set("startTime", startTime)
    if (endTime) params.set("endTime", endTime)

    const res = await fetch(`/api/audit/admin-reports?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch admin reports (${res.status})`)
    }
    return res.json()
  }, [application, userKey, startTime, endTime])

  const { data, loading, error, refetch } = useCachedQuery<AdminReportsResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    activities: data?.activities ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    scope: data?.scope ?? "full",
    loading,
    error,
    refetch,
  }
}
