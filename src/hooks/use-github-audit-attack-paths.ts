"use client"

import { useMemo, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { useProvider } from "@/components/providers/provider-context"
import { CACHE_TTL_LIST } from "@/lib/cache"
import { buildGitHubAttackPaths } from "@/lib/audit/github-attack-path-builder"
import type { GitHubAuditData } from "@/lib/audit/github-risk-scoring"
import type { AttackPathResult } from "@/lib/audit/attack-path-builder"

export function useGitHubAuditAttackPaths() {
  const { loading: providerLoading } = useProvider()
  const cacheKey = "github:audit:risk-data"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/github/audit/risk-data")
    if (!res.ok) throw new Error("Failed to fetch GitHub audit data")
    return (await res.json()) as GitHubAuditData
  }, [])

  const { data, loading, error } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled: !providerLoading,
  })

  const result = useMemo<AttackPathResult | null>(() => {
    if (!data) return null
    return buildGitHubAttackPaths(data)
  }, [data])

  return {
    nodes: result?.nodes ?? [],
    edges: result?.edges ?? [],
    highlightedPaths: result?.highlightedPaths ?? [],
    loading: loading || providerLoading,
    error,
  }
}
