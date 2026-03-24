"use client"

import { useCallback, useMemo } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"
import { buildGitLabAttackPaths } from "@/lib/audit/gitlab-attack-path-builder"
import type { AttackPathResult } from "@/lib/audit/attack-path-builder"
import type { GitLabAuditData } from "@/lib/audit/gitlab-risk-scoring"

export function useGitLabAuditAttackPaths() {
  const cacheKey = "gitlab:audit:risk-data"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gitlab/audit/risk-data")
    if (!res.ok) throw new Error("Failed to fetch GitLab audit data")
    return (await res.json()) as GitLabAuditData
  }, [])

  const { data, loading, error } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  const result = useMemo<AttackPathResult>(() => {
    if (!data) {
      return { nodes: [], edges: [], highlightedPaths: [] }
    }
    return buildGitLabAttackPaths(data)
  }, [data])

  return {
    nodes: result.nodes,
    edges: result.edges,
    highlightedPaths: result.highlightedPaths,
    loading,
    error,
  }
}
