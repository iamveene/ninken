"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type EntraUser = {
  id: string
  displayName: string
  userPrincipalName: string
  mail?: string
  jobTitle?: string
  department?: string
  accountEnabled: boolean
  createdDateTime?: string
  lastSignInDateTime?: string
}

export type EntraUserDetail = EntraUser & {
  mobilePhone?: string
  officeLocation?: string
  companyName?: string
  assignedLicenses?: { skuId: string }[]
  memberOf?: { id: string; displayName: string; "@odata.type": string }[]
}

export type EntraGroup = {
  id: string
  displayName: string
  description?: string
  mail?: string
  groupTypes: string[]
  membershipRule?: string
  securityEnabled: boolean
}

export type EntraGroupMember = {
  id: string
  displayName: string
  userPrincipalName?: string
  "@odata.type": string
}

export type EntraRole = {
  id: string
  displayName: string
  description?: string
  isBuiltIn?: boolean
  members: { id: string; displayName: string; userPrincipalName?: string }[]
}

export function useEntraUsers(query?: string) {
  const cacheKey = `entra:users:${query || "all"}`

  const fetcher = useCallback(async (): Promise<EntraUser[]> => {
    const params = new URLSearchParams()
    if (query) params.set("search", query)
    const res = await fetch(`/api/microsoft/directory/users?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch users (${res.status})`)
    }
    const json = await res.json()
    return json.users ?? []
  }, [query])

  const { data, loading, error, refetch } = useCachedQuery<EntraUser[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { users: data ?? [], loading, error, refetch }
}

export function useEntraUserDetail(userId: string | null) {
  const cacheKey = userId ? `entra:user:${userId}` : null

  const fetcher = useCallback(async (): Promise<EntraUserDetail> => {
    const res = await fetch(`/api/microsoft/directory/users/${userId}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch user detail (${res.status})`)
    }
    return res.json()
  }, [userId])

  const { data, loading, error } = useCachedQuery<EntraUserDetail>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { user: data, loading, error }
}

export function useEntraGroups(query?: string) {
  const cacheKey = `entra:groups:${query || "all"}`

  const fetcher = useCallback(async (): Promise<EntraGroup[]> => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    const res = await fetch(`/api/microsoft/directory/groups?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch groups (${res.status})`)
    }
    const json = await res.json()
    return json.groups ?? []
  }, [query])

  const { data, loading, error, refetch } = useCachedQuery<EntraGroup[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { groups: data ?? [], loading, error, refetch }
}

export function useEntraGroupMembers(groupId: string | null) {
  const cacheKey = groupId ? `entra:group-members:${groupId}` : null

  const fetcher = useCallback(async (): Promise<EntraGroupMember[]> => {
    const res = await fetch(`/api/microsoft/directory/groups/${groupId}/members`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch group members (${res.status})`)
    }
    const json = await res.json()
    return json.members ?? []
  }, [groupId])

  const { data, loading, error } = useCachedQuery<EntraGroupMember[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { members: data ?? [], loading, error }
}

export function useEntraRoles() {
  const fetcher = useCallback(async (): Promise<EntraRole[]> => {
    const res = await fetch("/api/microsoft/directory/roles")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch roles (${res.status})`)
    }
    const json = await res.json()
    return json.roles ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<EntraRole[]>(
    "entra:roles",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { roles: data ?? [], loading, error, refetch }
}
