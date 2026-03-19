"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_BODY } from "@/lib/cache"

export type M365AuditOverview = {
  tokenInfo: {
    scopes: string[]
    expiresIn: number
    email: string
    tenantId: string
  }
  me: { accessible: boolean }
  outlook: { accessible: boolean }
  onedrive: { accessible: boolean }
  teams: { accessible: boolean }
  directory: { accessible: boolean }
}

export function useM365AuditOverview() {
  const fetcher = useCallback(async (): Promise<M365AuditOverview> => {
    const res = await fetch("/api/microsoft/audit/overview")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch M365 audit overview (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<M365AuditOverview>(
    "m365-audit:overview",
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { overview: data, loading, error, refetch }
}
