"use client"

import { useMemo, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { useProvider } from "@/components/providers/provider-context"
import { CACHE_TTL_LIST } from "@/lib/cache"
import {
  computeCaBypassAssessment,
  type CaBypassAssessment,
  type CaBypassPolicy,
  type CaBypassNamedLocation,
} from "@/lib/audit/ca-bypass-scoring"

type CaBypassData = {
  policies: CaBypassPolicy[]
  namedLocations: CaBypassNamedLocation[]
  securityDefaultsEnabled: boolean | null
}

export function useM365CaBypass(enabled = true) {
  const { loading: providerLoading } = useProvider()
  const cacheKey = "m365-audit:ca-bypass"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/microsoft/audit/ca-bypass")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to fetch CA bypass data")
    }
    return (await res.json()) as CaBypassData
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled: enabled && !providerLoading,
  })

  const assessment = useMemo<CaBypassAssessment | null>(() => {
    if (!enabled || !data) return null
    return computeCaBypassAssessment(data.policies, data.namedLocations)
  }, [enabled, data])

  return {
    assessment,
    data,
    loading: enabled && (loading || providerLoading),
    error,
    refetch,
  }
}
