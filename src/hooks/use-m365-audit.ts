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
  userDisplayName: string | null
  userPrincipalName: string | null
  appDisplayName: string | null
  ipAddress: string | null
  location: SignInLocation
  status: SignInStatus
  deviceDetail: SignInDeviceDetail
  riskDetail: string
  riskLevelAggregated: string
  riskLevelDuringSignIn: string
  riskState: string
  conditionalAccessStatus: string
  authenticationRequirement?: string
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
  userDisplayName: string | null
  userPrincipalName: string | null
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
  ipAddress: string | null
  location: SignInLocation
  activityDateTime: string
  detectedDateTime: string
  userDisplayName: string | null
  userPrincipalName: string | null
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

export type CAUserCondition = {
  includeUsers?: string[]
  excludeUsers?: string[]
  includeGroups?: string[]
  excludeGroups?: string[]
  includeRoles?: string[]
  excludeRoles?: string[]
  includeGuestsOrExternalUsers?: Record<string, unknown>
  excludeGuestsOrExternalUsers?: Record<string, unknown>
}

export type CAApplicationCondition = {
  includeApplications?: string[]
  excludeApplications?: string[]
  includeUserActions?: string[]
  includeAuthenticationContextClassReferences?: string[]
}

export type CAPlatformCondition = {
  includePlatforms?: string[]
  excludePlatforms?: string[]
}

export type CALocationCondition = {
  includeLocations?: string[]
  excludeLocations?: string[]
}

export type CAConditions = {
  users?: CAUserCondition
  applications?: CAApplicationCondition
  platforms?: CAPlatformCondition
  locations?: CALocationCondition
  userRiskLevels?: string[]
  signInRiskLevels?: string[]
  clientAppTypes?: string[]
  servicePrincipalRiskLevels?: string[]
  devices?: Record<string, unknown>
}

export type CAGrantControls = {
  operator?: string
  builtInControls?: string[]
  customAuthenticationFactors?: string[]
  termsOfUse?: string[]
  authenticationStrength?: {
    id?: string
    displayName?: string
  }
}

export type CASessionControls = {
  applicationEnforcedRestrictions?: { isEnabled?: boolean }
  cloudAppSecurity?: { isEnabled?: boolean; cloudAppSecurityType?: string }
  signInFrequency?: {
    isEnabled?: boolean
    value?: number
    type?: string
    frequencyInterval?: string
    authenticationType?: string
  }
  persistentBrowser?: { isEnabled?: boolean; mode?: string }
  continuousAccessEvaluation?: { mode?: string }
  disableResilienceDefaults?: boolean
}

export type ConditionalAccessPolicy = {
  id: string
  displayName: string
  state: string
  createdDateTime: string
  modifiedDateTime: string
  conditions: CAConditions
  grantControls: CAGrantControls | null
  sessionControls: CASessionControls | null
}

export type NamedLocation = {
  id: string
  displayName: string
  isTrusted?: boolean
}

type ConditionalAccessData = {
  policies: ConditionalAccessPolicy[]
  namedLocations: NamedLocation[]
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
  }>("m365-audit:cross-tenant", fetcher, { ttlMs: CACHE_TTL_BODY })

  return {
    defaultPolicy: data?.defaultPolicy ?? null,
    partners: data?.partners ?? [],
    loading,
    error,
    refetch,
  }
}

// Resource Pivot Probing
// ---------------------------------------------------------------------------

export type ResourceProbeEntry = {
  accessible: boolean
  tokenObtained: boolean
  httpStatus?: number
  error?: string
}

export type ResourcePivotResult = {
  arm: ResourceProbeEntry & { subscriptions?: { id: string; name: string }[] }
  keyVault: ResourceProbeEntry & { vaults?: string[] }
  storage: ResourceProbeEntry
  devops: ResourceProbeEntry & { projects?: string[] }
}

export function useResourcePivot() {
  const fetcher = useCallback(async (): Promise<ResourcePivotResult> => {
    const res = await fetch("/api/microsoft/audit/resource-pivot")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch resource pivot data (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<ResourcePivotResult>(
    "m365-audit:resource-pivot",
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { pivot: data, loading, error, refetch }
}

// ---------------------------------------------------------------------------
// Conditional Access Policies
// ---------------------------------------------------------------------------

export function useConditionalAccessPolicies() {
  const fetcher = useCallback(async (): Promise<ConditionalAccessData> => {
    const res = await fetch("/api/microsoft/audit/conditional-access")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch conditional access policies (${res.status})`)
    }
    const json = await res.json()
    return {
      policies: json.policies ?? [],
      namedLocations: json.namedLocations ?? [],
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<ConditionalAccessData>(
    "m365-audit:conditional-access",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    policies: data?.policies ?? [],
    namedLocations: data?.namedLocations ?? [],
    loading,
    error,
    refetch,
  }
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

// ---------------------------------------------------------------------------
// Service Principals
// ---------------------------------------------------------------------------

export type ServicePrincipalAuditEntry = {
  id: string
  appId: string
  displayName: string
  servicePrincipalType: string
  accountEnabled: boolean
  appRoleAssignments: { id: string; resourceDisplayName: string; appRoleId: string; principalDisplayName: string }[]
  delegatedPermissions: { scope: string; consentType: string; principalId?: string }[]
}

export function useServicePrincipals() {
  const fetcher = useCallback(async (): Promise<ServicePrincipalAuditEntry[]> => {
    const res = await fetch("/api/microsoft/audit/service-principals")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch service principals (${res.status})`)
    }
    const json = await res.json()
    return json.servicePrincipals ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<ServicePrincipalAuditEntry[]>(
    "m365-audit:service-principals",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { servicePrincipals: data ?? [], loading, error, refetch }
}
