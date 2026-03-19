"use client"

import { useCallback, useState } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type DriveActivityActor = {
  type: "user" | "system"
  email?: string
  displayName?: string
}

export type DriveActivityTarget = {
  type: "driveItem" | "teamDrive"
  name: string
  title?: string
  mimeType?: string
}

export type DriveActivityEntry = {
  timestamp: string | null
  actors: DriveActivityActor[]
  actionType: string
  targets: DriveActivityTarget[]
  isPermissionChange: boolean
  isExternalShare: boolean
}

type DriveActivityResult = {
  activities: DriveActivityEntry[]
  nextPageToken: string | null
  scope: "granted" | "denied"
}

export function useAuditDriveActivity(filter?: string) {
  const [pageToken, setPageToken] = useState<string | undefined>(undefined)

  const cacheKey = `audit:drive-activity:${filter || "all"}:${pageToken || "first"}`

  const fetcher = useCallback(async (): Promise<DriveActivityResult> => {
    const params = new URLSearchParams()
    params.set("pageSize", "50")
    if (pageToken) params.set("pageToken", pageToken)
    if (filter) params.set("filter", filter)

    const res = await fetch(`/api/audit/drive-activity?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(
        data.error || `Failed to fetch drive activity (${res.status})`
      )
    }
    return res.json()
  }, [pageToken, filter])

  const { data, loading, error, refetch } =
    useCachedQuery<DriveActivityResult>(cacheKey, fetcher, {
      ttlMs: CACHE_TTL_LIST,
    })

  return {
    activities: data?.activities ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    scope: data?.scope ?? "granted",
    loading,
    error,
    refetch,
    pageToken,
    setPageToken,
  }
}
