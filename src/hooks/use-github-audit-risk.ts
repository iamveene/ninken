"use client"

import { useMemo, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { useProvider } from "@/components/providers/provider-context"
import { CACHE_TTL_LIST } from "@/lib/cache"
import { computeGitHubRiskAssessment, type GitHubAuditData, type GitHubRiskAssessment } from "@/lib/audit/github-risk-scoring"

export function useGitHubAuditRisk(enabled = true) {
  const { loading: providerLoading } = useProvider()
  const cacheKey = "github:audit:risk-data"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/github/audit/risk-data")
    if (!res.ok) throw new Error("Failed to fetch GitHub audit risk data")
    return (await res.json()) as GitHubAuditData
  }, [])

  const { data, loading, error } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled: enabled && !providerLoading,
  })

  const assessment = useMemo<GitHubRiskAssessment | null>(() => {
    if (!enabled || !data) return null
    return computeGitHubRiskAssessment(data)
  }, [enabled, data])

  return {
    assessment,
    data,
    loading: enabled && (loading || providerLoading),
    error,
  }
}
