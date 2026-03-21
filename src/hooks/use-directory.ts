"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type DirectoryUser = {
  id: string
  primaryEmail: string
  name: {
    fullName: string
    givenName?: string
    familyName?: string
  }
  thumbnailPhotoUrl?: string
  orgUnitPath?: string
  isAdmin?: boolean
  suspended?: boolean
  organizations?: {
    title?: string
    department?: string
    description?: string
    primary?: boolean
  }[]
  phones?: { value: string; type?: string; primary?: boolean }[]
  addresses?: { formatted?: string; type?: string; primary?: boolean }[]
  relations?: { value: string; type?: string }[]
  lastLoginTime?: string
  creationTime?: string
}

export type DirectoryGroup = {
  id: string
  email: string
  name: string
  description?: string
  directMembersCount?: string
  adminCreated?: boolean
}

export type GroupMember = {
  id: string
  email: string
  role: string
  type: string
  status?: string
}

export function useUsers(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const cacheKey = `directory:users:${debouncedQuery}`

  const fetcher = useCallback(async (): Promise<DirectoryUser[]> => {
    const params = new URLSearchParams()
    if (debouncedQuery) params.set("query", debouncedQuery)
    const res = await fetch(`/api/directory/users?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to fetch users")
    }
    const data = await res.json()
    return data.users || []
  }, [debouncedQuery])

  const { data, loading, error, refetch } = useCachedQuery<DirectoryUser[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { users: data ?? [], loading, error, refetch }
}

export function useUserDetail(userId: string | null) {
  const cacheKey = userId ? `directory:user:${userId}` : null

  const fetcher = useCallback(async (): Promise<DirectoryUser> => {
    const res = await fetch(`/api/directory/users/${userId}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to fetch user")
    }
    return res.json()
  }, [userId])

  const { data, loading, error } = useCachedQuery<DirectoryUser>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { user: data, loading, error }
}

export function useGroups(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const cacheKey = `directory:groups:${debouncedQuery}`

  const fetcher = useCallback(async (): Promise<DirectoryGroup[]> => {
    const params = new URLSearchParams()
    if (debouncedQuery) params.set("query", debouncedQuery)
    const res = await fetch(`/api/directory/groups?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to fetch groups")
    }
    const data = await res.json()
    return data.groups || []
  }, [debouncedQuery])

  const { data, loading, error, refetch } = useCachedQuery<DirectoryGroup[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { groups: data ?? [], loading, error, refetch }
}

export function useGroupMembers(groupId: string | null) {
  const cacheKey = groupId ? `directory:group:${groupId}:members` : null

  const fetcher = useCallback(async (): Promise<GroupMember[]> => {
    const res = await fetch(`/api/directory/groups/${groupId}/members`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to fetch members")
    }
    const data = await res.json()
    return data.members || []
  }, [groupId])

  const { data, loading, error } = useCachedQuery<GroupMember[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { members: data ?? [], loading, error }
}
