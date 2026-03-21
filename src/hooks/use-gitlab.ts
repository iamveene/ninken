"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

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

export type GitLabTreeItem = {
  id: string
  name: string
  type: "tree" | "blob"
  path: string
  mode: string
}

export type GitLabFileContent = {
  fileName: string
  filePath: string
  size: number
  content: string | null
  encoding: string
  ref: string
  truncated: boolean
}

export type GitLabBranch = {
  name: string
  default: boolean
  webUrl: string
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

export function useGitLabTree(
  projectId: number | null,
  path: string,
  ref: string
) {
  const cacheKey = projectId
    ? `gitlab:tree:${projectId}:${ref}:${path}`
    : null

  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error("No project ID")
    const params = new URLSearchParams({ path, ref })
    const res = await fetch(
      `/api/gitlab/projects/${projectId}/tree?${params}`
    )
    if (!res.ok) throw new Error("Failed to fetch repository tree")
    const json = await res.json()
    return {
      items: (json.items ?? []) as GitLabTreeItem[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [projectId, path, ref])

  const { data, loading, error, refetch } = useCachedQuery(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST, enabled: !!projectId }
  )

  return {
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useGitLabFile(
  projectId: number | null,
  filePath: string | null,
  ref: string
) {
  const cacheKey =
    projectId && filePath
      ? `gitlab:file:${projectId}:${ref}:${filePath}`
      : null

  const fetcher = useCallback(async () => {
    if (!projectId || !filePath) throw new Error("No project ID or file path")
    const params = new URLSearchParams({ path: filePath, ref })
    const res = await fetch(
      `/api/gitlab/projects/${projectId}/file?${params}`
    )
    if (!res.ok) throw new Error("Failed to fetch file content")
    return (await res.json()) as GitLabFileContent
  }, [projectId, filePath, ref])

  const { data, loading, error, refetch } = useCachedQuery(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY, enabled: !!projectId && !!filePath }
  )

  return { file: data ?? null, loading, error, refetch }
}

export function useGitLabBranches(projectId: number | null) {
  const cacheKey = projectId ? `gitlab:branches:${projectId}` : null

  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error("No project ID")
    const res = await fetch(`/api/gitlab/projects/${projectId}/branches`)
    if (!res.ok) throw new Error("Failed to fetch branches")
    const json = await res.json()
    return {
      branches: (json.branches ?? []) as GitLabBranch[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [projectId])

  const { data, loading, error, refetch } = useCachedQuery(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST, enabled: !!projectId }
  )

  return {
    branches: data?.branches ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}
