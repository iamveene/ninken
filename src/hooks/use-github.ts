"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

// ── Types ────────────────────────────────────────────────────────────

export type GitHubUser = {
  login: string
  id: number
  name: string | null
  email: string | null
  avatarUrl: string
  htmlUrl: string
  type: string
  siteAdmin: boolean
  company: string | null
  bio: string | null
  publicRepos: number
  publicGists: number
  followers: number
  following: number
  createdAt: string
  twoFactorAuthentication: boolean | null
  scopes: string[]
  tokenType: "classic" | "fine-grained" | "unknown"
  rateLimit: { remaining: number; reset: number }
}

export type GitHubRepo = {
  id: number
  name: string
  fullName: string
  description: string | null
  private: boolean
  fork: boolean
  htmlUrl: string
  language: string | null
  stars: number
  forks: number
  openIssues: number
  defaultBranch: string
  archived: boolean
  visibility: string
  pushedAt: string | null
  updatedAt: string
  createdAt: string
  owner: string
  permissions: { admin: boolean; push: boolean; pull: boolean } | null
}

export type GitHubOrg = {
  login: string
  id: number
  description: string | null
  avatarUrl: string
}

export type GitHubGist = {
  id: string
  description: string | null
  public: boolean
  htmlUrl: string
  files: { filename: string; language: string | null; size: number }[]
  createdAt: string
  updatedAt: string
  comments: number
  owner: string
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useGitHubUser() {
  const cacheKey = "github:me"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/github/me")
    if (!res.ok) throw new Error("Failed to fetch GitHub user")
    return (await res.json()) as GitHubUser
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return { user: data, loading, error, refetch }
}

export function useGitHubRepos(visibility?: string) {
  const cacheKey = `github:repos:${visibility || "all"}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (visibility) params.set("visibility", visibility)
    const res = await fetch(`/api/github/repos?${params}`)
    if (!res.ok) throw new Error("Failed to fetch repositories")
    const json = await res.json()
    return {
      repos: (json.repos ?? []) as GitHubRepo[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [visibility])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    repos: data?.repos ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useGitHubOrgs() {
  const cacheKey = "github:orgs"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/github/orgs")
    if (!res.ok) throw new Error("Failed to fetch organizations")
    const json = await res.json()
    return {
      orgs: (json.orgs ?? []) as GitHubOrg[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    orgs: data?.orgs ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useGitHubGists() {
  const cacheKey = "github:gists"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/github/gists")
    if (!res.ok) throw new Error("Failed to fetch gists")
    const json = await res.json()
    return {
      gists: (json.gists ?? []) as GitHubGist[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    gists: data?.gists ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}
