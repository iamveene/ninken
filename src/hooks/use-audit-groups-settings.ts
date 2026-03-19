"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type RiskLevel = "critical" | "high" | "medium" | "low"

export type GroupSettings = {
  email: string
  name: string
  whoCanJoin: string
  whoCanViewMembership: string
  whoCanPostMessage: string
  allowExternalMembers: string
  allowWebPosting: string
  isArchived: string
  membersCanPostAsTheGroup: string
  messageModerationLevel: string
  riskLevel: RiskLevel
  riskFactors: string[]
}

export type GroupsSettingsResult = {
  groups: GroupSettings[]
  scope: "organization" | "denied"
  skippedCount: number
}

export function useAuditGroupsSettings() {
  const fetcher = useCallback(async (): Promise<GroupsSettingsResult> => {
    const res = await fetch("/api/audit/groups-settings")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch groups settings (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<GroupsSettingsResult>(
    "audit:groups-settings",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    groups: data?.groups ?? [],
    scope: data?.scope ?? "organization",
    skippedCount: data?.skippedCount ?? 0,
    loading,
    error,
    refetch,
  }
}
