"use client"

import { useCallback, useMemo } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"
import {
  computeGitLabRiskAssessment,
  type GitLabAuditData,
  type GitLabRiskAssessment,
} from "@/lib/audit/gitlab-risk-scoring"

export function useGitLabAuditRisk(enabled = true) {
  const cacheKey = enabled ? "gitlab:audit:risk-data" : null

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gitlab/audit/risk-data")
    if (!res.ok) throw new Error("Failed to fetch GitLab audit risk data")
    return (await res.json()) as GitLabAuditData
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled,
  })

  const assessment = useMemo<GitLabRiskAssessment | null>(() => {
    if (!enabled || !data) return null
    return computeGitLabRiskAssessment(data)
  }, [enabled, data])

  const partialData = data != null && data.projects.length > 0

  return {
    data,
    assessment,
    loading: enabled && loading,
    error,
    partialData,
    refetch,
  }
}
