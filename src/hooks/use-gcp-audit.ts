"use client"

import { useMemo, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { useProvider } from "@/components/providers/provider-context"
import { CACHE_TTL_LIST } from "@/lib/cache"
import { analyzeBucketIam, analyzeFirewallRules, type GcpBucketAuditResult, type GcpFirewallAuditResult } from "@/lib/gcp-audit"
import { computeGcpRisk, type GcpRiskAssessment, type GcpRiskInput } from "@/lib/audit/gcp-risk-scoring"

// ── Types ────────────────────────────────────────────────────────────

type BucketIamRaw = {
  name: string
  iamBindings: { role: string; members: string[] }[]
}

type FirewallRuleRaw = {
  name: string
  network: string
  direction: string
  sourceRanges?: string[]
  allowed?: { IPProtocol: string; ports?: string[] }[]
  denied?: { IPProtocol: string; ports?: string[] }[]
}

export type GcpApiKeyEntry = {
  name: string
  displayName?: string | null
  restrictions?: {
    browserKeyRestrictions?: unknown
    serverKeyRestrictions?: unknown
    androidKeyRestrictions?: unknown
    iosKeyRestrictions?: unknown
    apiTargets?: { service: string }[]
  } | null
  hasApplicationRestrictions: boolean
  hasApiRestrictions: boolean
  apiTargets: string[]
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useGcpAuditBuckets() {
  const { loading: providerLoading } = useProvider()
  const cacheKey = "gcp:audit:buckets"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gcp-key/audit/buckets")
    if (!res.ok) throw new Error("Failed to fetch GCP bucket audit data")
    return (await res.json()) as { buckets: BucketIamRaw[]; results: GcpBucketAuditResult[] }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled: !providerLoading,
  })

  return {
    results: data?.results ?? [],
    loading: loading || providerLoading,
    error,
    refetch,
  }
}

export function useGcpAuditFirewall() {
  const { loading: providerLoading } = useProvider()
  const cacheKey = "gcp:audit:firewall"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gcp-key/audit/firewall")
    if (!res.ok) throw new Error("Failed to fetch GCP firewall audit data")
    return (await res.json()) as { rules: GcpFirewallAuditResult[] }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled: !providerLoading,
  })

  return {
    rules: data?.rules ?? [],
    loading: loading || providerLoading,
    error,
    refetch,
  }
}

export function useGcpAuditApiKeys() {
  const { loading: providerLoading } = useProvider()
  const cacheKey = "gcp:audit:api-keys"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gcp-key/audit/api-keys")
    if (!res.ok) {
      if (res.status === 403) {
        return { keys: [], unavailable: true, message: "API Keys API access restricted" }
      }
      throw new Error("Failed to fetch GCP API key data")
    }
    return (await res.json()) as {
      keys: GcpApiKeyEntry[]
      unavailable?: boolean
      message?: string
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
    enabled: !providerLoading,
  })

  return {
    keys: data?.keys ?? [],
    unavailable: data?.unavailable ?? false,
    message: data?.message,
    loading: loading || providerLoading,
    error,
    refetch,
  }
}

export function useGcpAuditRisk(enabled = true) {
  const { loading: providerLoading } = useProvider()
  const { results: bucketResults, loading: bucketsLoading, error: bucketsError } = useGcpAuditBuckets()
  const { rules: firewallRules, loading: firewallLoading, error: firewallError } = useGcpAuditFirewall()
  const { keys: apiKeysRaw, loading: apiKeysLoading, error: apiKeysError } = useGcpAuditApiKeys()

  const loading = enabled && (providerLoading || bucketsLoading || firewallLoading || apiKeysLoading)
  const error = bucketsError || firewallError || apiKeysError

  const assessment = useMemo<GcpRiskAssessment | null>(() => {
    if (!enabled) return null
    // Wait for all data sources before computing risk
    if (bucketsLoading || firewallLoading || apiKeysLoading) return null

    const riskInput: GcpRiskInput = {
      buckets: bucketResults.map((b) => ({
        bucketName: b.bucketName,
        isPublic: b.isPublic,
        publicMembers: b.publicMembers,
        roles: b.roles,
      })),
      firewallRules: firewallRules.map((r) => ({
        name: r.name,
        isOpenToWorld: r.isOpenToWorld,
        riskLevel: r.riskLevel,
        sourceRanges: r.sourceRanges,
        allowed: r.allowed,
      })),
      apiKeys: apiKeysRaw.map((k) => ({
        name: k.name,
        hasApplicationRestrictions: k.hasApplicationRestrictions,
        hasApiRestrictions: k.hasApiRestrictions,
      })),
      serviceAccountKeys: [], // Would need IAM Admin API access — leave empty for now
    }

    return computeGcpRisk(riskInput)
  }, [enabled, bucketResults, firewallRules, apiKeysRaw, bucketsLoading, firewallLoading, apiKeysLoading])

  return {
    assessment,
    loading,
    error,
  }
}
