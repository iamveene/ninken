"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_BODY, CACHE_TTL_LIST } from "@/lib/cache"

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

// ---------------------------------------------------------------------------
// Sign-In Logs
// ---------------------------------------------------------------------------

export type SignInLocation = {
  city?: string
  state?: string
  countryOrRegion?: string
}

export type SignInStatus = {
  errorCode?: number
  failureReason?: string
  additionalDetails?: string
}

export type SignInDeviceDetail = {
  deviceId?: string
  displayName?: string
  operatingSystem?: string
  browser?: string
  isCompliant?: boolean
  isManaged?: boolean
}

export type SignInRecord = {
  id: string
  createdDateTime: string
  userDisplayName: string
  userPrincipalName: string
  appDisplayName: string
  ipAddress: string
  location: SignInLocation
  status: SignInStatus
  deviceDetail: SignInDeviceDetail
  riskDetail: string
  riskLevelAggregated: string
  riskLevelDuringSignIn: string
  riskState: string
  conditionalAccessStatus: string
}

export function useSignInLogs() {
  const fetcher = useCallback(async (): Promise<SignInRecord[]> => {
    const res = await fetch("/api/microsoft/audit/sign-ins?top=200")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch sign-in logs (${res.status})`)
    }
    const json = await res.json()
    return json.signIns ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<SignInRecord[]>(
    "m365-audit:sign-ins",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { signIns: data ?? [], loading, error, refetch }
}

// ---------------------------------------------------------------------------
// Risky Users
// ---------------------------------------------------------------------------

export type RiskyUser = {
  id: string
  userDisplayName: string
  userPrincipalName: string
  riskLevel: string
  riskState: string
  riskDetail: string
  riskLastUpdatedDateTime: string
  isDeleted: boolean
  isProcessing: boolean
}

export function useRiskyUsers() {
  const fetcher = useCallback(async (): Promise<RiskyUser[]> => {
    const res = await fetch("/api/microsoft/audit/risky-users?top=200")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch risky users (${res.status})`)
    }
    const json = await res.json()
    return json.riskyUsers ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<RiskyUser[]>(
    "m365-audit:risky-users",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { riskyUsers: data ?? [], loading, error, refetch }
}

// ---------------------------------------------------------------------------
// Risk Detections
// ---------------------------------------------------------------------------

export type RiskDetection = {
  id: string
  riskEventType: string
  riskLevel: string
  riskState: string
  riskDetail: string
  detectionTimingType: string
  activity: string
  ipAddress: string
  location: SignInLocation
  activityDateTime: string
  detectedDateTime: string
  userDisplayName: string
  userPrincipalName: string
  userId: string
}

export function useRiskDetections(userId?: string) {
  const fetcher = useCallback(async (): Promise<RiskDetection[]> => {
    const params = new URLSearchParams({ top: "200" })
    if (userId) params.set("userId", userId)
    const res = await fetch(`/api/microsoft/audit/risk-detections?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch risk detections (${res.status})`)
    }
    const json = await res.json()
    return json.riskDetections ?? []
  }, [userId])

  const cacheKey = userId
    ? `m365-audit:risk-detections:${userId}`
    : "m365-audit:risk-detections"

  const { data, loading, error, refetch } = useCachedQuery<RiskDetection[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { riskDetections: data ?? [], loading, error, refetch }
}

// ---------------------------------------------------------------------------
// Conditional Access Policies
// ---------------------------------------------------------------------------

export type ConditionalAccessPolicy = {
  id: string
  displayName: string
  state: string
  createdDateTime: string
  modifiedDateTime: string
  conditions: Record<string, unknown>
  grantControls: {
    operator?: string
    builtInControls?: string[]
    customAuthenticationFactors?: string[]
  } | null
  sessionControls: Record<string, unknown> | null
}

export function useConditionalAccessPolicies() {
  const fetcher = useCallback(async (): Promise<ConditionalAccessPolicy[]> => {
    const res = await fetch("/api/microsoft/audit/conditional-access")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch conditional access policies (${res.status})`)
    }
    const json = await res.json()
    return json.policies ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<ConditionalAccessPolicy[]>(
    "m365-audit:conditional-access",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { policies: data ?? [], loading, error, refetch }
}
