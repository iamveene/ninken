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

// ---------------------------------------------------------------------------
// Cross-Tenant Access
// ---------------------------------------------------------------------------

export type CrossTenantInboundTrust = {
  isMfaAccepted?: boolean
  isCompliantDeviceAccepted?: boolean
  isHybridAzureADJoinedDeviceAccepted?: boolean
}

export type CrossTenantDefaultPolicy = {
  inboundTrust?: CrossTenantInboundTrust
  b2bCollaborationInbound?: Record<string, unknown>
  b2bCollaborationOutbound?: Record<string, unknown>
  b2bDirectConnectInbound?: Record<string, unknown>
  b2bDirectConnectOutbound?: Record<string, unknown>
}

export type CrossTenantPartner = {
  tenantId: string
  inboundTrust?: CrossTenantInboundTrust
  b2bCollaborationInbound?: Record<string, unknown>
  b2bCollaborationOutbound?: Record<string, unknown>
  b2bDirectConnectInbound?: Record<string, unknown>
  b2bDirectConnectOutbound?: Record<string, unknown>
  isServiceProvider?: boolean
  isInMultiTenantOrganization?: boolean
}

export function useCrossTenantAccess() {
  const fetcher = useCallback(async (): Promise<{
    defaultPolicy: CrossTenantDefaultPolicy
    partners: CrossTenantPartner[]
  }> => {
    const res = await fetch("/api/microsoft/audit/cross-tenant")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch cross-tenant access policy (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<{
    defaultPolicy: CrossTenantDefaultPolicy
    partners: CrossTenantPartner[]
  }>(
    "m365-audit:cross-tenant",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    defaultPolicy: data?.defaultPolicy ?? null,
    partners: data?.partners ?? [],
    loading,
    error,
    refetch,
  }
}

// ---------------------------------------------------------------------------
// Conditional Access Policies
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Authentication Methods
// ---------------------------------------------------------------------------

export type AuthMethod = {
  odataType: string
  id: string
  displayName?: string
  phoneNumber?: string
  phoneType?: string
  createdDateTime?: string
}

export type AuthMethodUser = {
  id: string
  displayName: string
  userPrincipalName: string
  methods: AuthMethod[]
}

export type AuthMethodAggregate = {
  total: number
  passwordOnly: number
  phoneOnlyMfa: number
  fido2: number
  microsoftAuthenticator: number
  phone: number
  email: number
  softwareOath: number
  temporaryAccessPass: number
  windowsHello: number
}

type AuthMethodsResponse = {
  scope: "tenant" | "me"
  users: {
    id: string
    displayName: string
    userPrincipalName: string
    methods: {
      "@odata.type": string
      id: string
      displayName?: string
      phoneNumber?: string
      phoneType?: string
      createdDateTime?: string
    }[]
  }[]
}

function normalizeMethod(raw: AuthMethodsResponse["users"][0]["methods"][0]): AuthMethod {
  return {
    odataType: raw["@odata.type"],
    id: raw.id,
    displayName: raw.displayName,
    phoneNumber: raw.phoneNumber,
    phoneType: raw.phoneType,
    createdDateTime: raw.createdDateTime,
  }
}

export function useAuthenticationMethods() {
  const fetcher = useCallback(async (): Promise<{ scope: "tenant" | "me"; users: AuthMethodUser[] }> => {
    const res = await fetch("/api/microsoft/audit/auth-methods")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch authentication methods (${res.status})`)
    }
    const json: AuthMethodsResponse = await res.json()
    return {
      scope: json.scope,
      users: json.users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        userPrincipalName: u.userPrincipalName,
        methods: u.methods.map(normalizeMethod),
      })),
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<{ scope: "tenant" | "me"; users: AuthMethodUser[] }>(
    "m365-audit:auth-methods",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    users: data?.users ?? [],
    scope: data?.scope ?? null,
    loading,
    error,
    refetch,
  }
}
