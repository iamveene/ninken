"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type OrgUnit = {
  orgUnitId: string
  name: string
  orgUnitPath: string
  parentOrgUnitPath: string
  parentOrgUnitId: string
  description: string
  blockInheritance: boolean
}

export type Domain = {
  domainName: string
  isPrimary: boolean
  verified: boolean
  creationTime: string
}

type PoliciesResult = {
  orgUnits: OrgUnit[]
  domains: Domain[]
  scope: "organization" | "limited"
}

export function useAuditPolicies() {
  const fetcher = useCallback(async (): Promise<PoliciesResult> => {
    const res = await fetch("/api/audit/policies")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch policies (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<PoliciesResult>(
    "audit:policies",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    orgUnits: data?.orgUnits ?? [],
    domains: data?.domains ?? [],
    scope: data?.scope ?? "organization",
    loading,
    error,
    refetch,
  }
}
