"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

// ── Types ────────────────────────────────────────────────────────────

export type GitLabUser = {
  id: number
  username: string
  name: string
  email: string | null
  avatarUrl: string
  webUrl: string
  state: string
  isAdmin: boolean
  bio: string | null
  publicEmail: string | null
  createdAt: string
  twoFactorEnabled: boolean
  scopes: string[]
  tokenName: string | null
  tokenExpiresAt: string | null
  rateLimit: { remaining: number; reset: number }
}

export type GitLabProject = {
  id: number
  name: string
  nameWithNamespace: string
  pathWithNamespace: string
  description: string | null
  visibility: string
  webUrl: string
  defaultBranch: string | null
  archived: boolean
  forked: boolean
  stars: number
  forks: number
  openIssuesCount: number
  lastActivityAt: string
  createdAt: string
  namespace: string
  avatarUrl: string | null
}

export type GitLabGroup = {
  id: number
  name: string
  fullName: string
  fullPath: string
  description: string | null
  visibility: string
  webUrl: string
  avatarUrl: string | null
  parentId: number | null
  createdAt: string
  projectCount: number
  memberCount: number
}

export type GitLabSnippet = {
  id: number
  title: string
  description: string | null
  visibility: string
  webUrl: string
  fileName: string | null
  createdAt: string
  updatedAt: string
  author: string
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useGitLabUser() {
  const cacheKey = "gitlab:me"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gitlab/me")
    if (!res.ok) throw new Error("Failed to fetch GitLab user")
    return (await res.json()) as GitLabUser
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return { user: data, loading, error, refetch }
}

export function useGitLabProjects() {
  const cacheKey = "gitlab:projects"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gitlab/projects")
    if (!res.ok) throw new Error("Failed to fetch projects")
    const json = await res.json()
    return {
      projects: (json.projects ?? []) as GitLabProject[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    projects: data?.projects ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useGitLabGroups() {
  const cacheKey = "gitlab:groups"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gitlab/groups")
    if (!res.ok) throw new Error("Failed to fetch groups")
    const json = await res.json()
    return {
      groups: (json.groups ?? []) as GitLabGroup[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    groups: data?.groups ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useGitLabSnippets() {
  const cacheKey = "gitlab:snippets"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gitlab/snippets")
    if (!res.ok) throw new Error("Failed to fetch snippets")
    const json = await res.json()
    return {
      snippets: (json.snippets ?? []) as GitLabSnippet[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    snippets: data?.snippets ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}
