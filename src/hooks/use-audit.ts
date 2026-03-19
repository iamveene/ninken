"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type AuditOverview = {
  tokenInfo: {
    scopes: string[]
    scopeCount: number
    expiresInSeconds: number | null
    email: string | null
  }
  gmail: { accessible: boolean; email?: string; messagesTotal?: number; threadsTotal?: number; labelCount?: number }
  drive: { accessible: boolean; hasFiles?: boolean; sharedDriveCount?: number }
  calendar: { accessible: boolean; calendarCount?: number }
  storage: { accessible: boolean; projectCount?: number; accessibleProjectsEstimate?: number }
  directory: { accessible: boolean; hasAdminAccess?: boolean; userCountEstimate?: number }
}

export function useAuditOverview() {
  const fetcher = useCallback(async (): Promise<AuditOverview> => {
    const res = await fetch("/api/audit/overview")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch audit overview (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<AuditOverview>(
    "audit:overview",
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { overview: data, loading, error, refetch }
}

export type AuditUser = {
  primaryEmail: string
  fullName: string
  isAdmin: boolean
  isDelegatedAdmin: boolean
  isEnrolledIn2Sv: boolean
  isEnforcedIn2Sv: boolean
  suspended: boolean
  lastLoginTime: string | null
  orgUnitPath: string
  creationTime: string
}

export type AuditGroup = {
  id: string
  name: string
  email: string
  directMembersCount: string
  description: string
}

export type AuditRole = {
  roleId: string
  roleName: string
  roleDescription: string
  isSystemRole: boolean
  isSuperAdminRole: boolean
  assignees: { assignedTo: string; scopeType: string }[]
}

export type AuditApp = {
  clientId: string
  displayText: string
  scopes: string[]
  userKey: string
}

export type AuditDelegation = {
  serviceAccountId: string
  scopes: string[]
}

type AuditUsersResult = {
  users: AuditUser[]
  nextPageToken: string | null
}

type AuditGroupsResult = {
  groups: AuditGroup[]
  nextPageToken: string | null
}

type AuditRolesResult = {
  roles: AuditRole[]
}

type AuditAppsResult = {
  apps: AuditApp[]
  note?: string
}

type AuditDelegationResult = {
  delegations: AuditDelegation[]
  note?: string
}

export function useAuditUsers(query?: string) {
  const cacheKey = query ? `audit:users:${query}` : "audit:users"

  const fetcher = useCallback(async (): Promise<AuditUsersResult> => {
    const params = new URLSearchParams()
    if (query) params.set("query", query)
    const res = await fetch(`/api/audit/users?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch audit users (${res.status})`)
    }
    return res.json()
  }, [query])

  const { data, loading, error, refetch } = useCachedQuery<AuditUsersResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    data: data ?? { users: [], nextPageToken: null },
    loading,
    error,
    refetch,
  }
}

export function useAuditGroups() {
  const fetcher = useCallback(async (): Promise<AuditGroupsResult> => {
    const res = await fetch("/api/audit/groups")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch audit groups (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<AuditGroupsResult>(
    "audit:groups",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    data: data ?? { groups: [], nextPageToken: null },
    loading,
    error,
    refetch,
  }
}

export function useAuditRoles() {
  const fetcher = useCallback(async (): Promise<AuditRolesResult> => {
    const res = await fetch("/api/audit/roles")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch audit roles (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<AuditRolesResult>(
    "audit:roles",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    data: data ?? { roles: [] },
    loading,
    error,
    refetch,
  }
}

export function useAuditApps() {
  const fetcher = useCallback(async (): Promise<AuditAppsResult> => {
    const res = await fetch("/api/audit/apps")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch audit apps (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<AuditAppsResult>(
    "audit:apps",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    apps: data?.apps ?? [],
    note: data?.note,
    loading,
    error,
    refetch,
  }
}

export function useAuditDelegation() {
  const fetcher = useCallback(async (): Promise<AuditDelegationResult> => {
    const res = await fetch("/api/audit/delegation")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch audit delegation (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<AuditDelegationResult>(
    "audit:delegation",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    delegations: data?.delegations ?? [],
    note: data?.note,
    loading,
    error,
    refetch,
  }
}
