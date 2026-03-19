"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type MarketplaceApp = {
  clientId: string
  displayText: string
  scopes: string[]
  userCount: number
  sampleUsers: string[]
  nativeApp: boolean
}

type MarketplaceResult = {
  apps: MarketplaceApp[]
  totalApps: number
  scope: "organization" | "limited"
}

export function useAuditMarketplace() {
  const fetcher = useCallback(async (): Promise<MarketplaceResult> => {
    const res = await fetch("/api/audit/marketplace")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch marketplace apps (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<MarketplaceResult>(
    "audit:marketplace",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    apps: data?.apps ?? [],
    totalApps: data?.totalApps ?? 0,
    scope: data?.scope ?? "organization",
    loading,
    error,
    refetch,
  }
}
