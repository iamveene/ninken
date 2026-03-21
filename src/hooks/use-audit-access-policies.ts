"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type RoleAssignment = {
  assignmentId: string
  assignedTo: string
  roleId: string
  roleName: string
  scopeType: string
  orgUnitId: string
}

export type SecuritySettings = {
  sampleSize?: number
  twoFactorEnrolled?: number
  twoFactorEnforced?: number
  twoFactorEnrollmentRate?: number
  twoFactorEnforcementRate?: number
}

export type CustomSchema = {
  schemaId: string
  schemaName: string
  displayName: string
  fieldCount: number
  fields: {
    fieldName: string
    fieldType: string
    readAccessType: string
    multiValued: boolean
  }[]
}

type AccessPoliciesResult = {
  delegations: RoleAssignment[]
  securitySettings: SecuritySettings
  schemas: CustomSchema[]
  scope: "organization" | "limited"
}

export function useAuditAccessPolicies() {
  const fetcher = useCallback(async (): Promise<AccessPoliciesResult> => {
    const res = await fetch("/api/audit/access-policies")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch access policies (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<AccessPoliciesResult>(
    "audit:access-policies",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    delegations: data?.delegations ?? [],
    securitySettings: data?.securitySettings ?? {},
    schemas: data?.schemas ?? [],
    scope: data?.scope ?? "organization",
    loading,
    error,
    refetch,
  }
}
