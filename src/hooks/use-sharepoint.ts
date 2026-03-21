"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { useProvider } from "@/components/providers/provider-context"
import { CACHE_TTL_LIST } from "@/lib/cache"

// ── Types ────────────────────────────────────────────────────────────

export type SharePointSite = {
  id: string
  displayName: string
  name: string
  webUrl: string
  lastModifiedDateTime?: string
  createdDateTime?: string
  description?: string
  root?: Record<string, unknown>
  siteCollection?: { hostname: string }
}

export type SharePointDrive = {
  id: string
  name: string
  driveType: string
  webUrl?: string
  lastModifiedDateTime?: string
  quota?: {
    total: number
    used: number
    remaining: number
  }
  owner?: {
    group?: { displayName: string }
    user?: { displayName: string }
  }
}

export type SharePointDriveItem = {
  id: string
  name: string
  size?: number
  createdDateTime?: string
  lastModifiedDateTime?: string
  webUrl?: string
  folder?: { childCount: number }
  file?: { mimeType: string }
  parentReference?: { id: string; path: string }
  createdBy?: { user?: { displayName: string } }
  lastModifiedBy?: { user?: { displayName: string } }
  "@microsoft.graph.downloadUrl"?: string
}

export type SharePointList = {
  id: string
  displayName: string
  name: string
  description?: string
  webUrl?: string
  lastModifiedDateTime?: string
  createdDateTime?: string
  list?: {
    template: string
    hidden: boolean
    contentTypesEnabled: boolean
  }
}

export type SharePointListItem = {
  id: string
  fields: Record<string, unknown>
  createdDateTime?: string
  lastModifiedDateTime?: string
  webUrl?: string
  createdBy?: { user?: { displayName: string } }
  lastModifiedBy?: { user?: { displayName: string } }
}

export type SharePointListColumn = {
  name: string
  displayName: string
  columnGroup?: string
  hidden?: boolean
  readOnly?: boolean
  text?: Record<string, unknown>
  dateTime?: Record<string, unknown>
  number?: Record<string, unknown>
  boolean?: Record<string, unknown>
  choice?: { choices: string[] }
  lookup?: Record<string, unknown>
  personOrGroup?: Record<string, unknown>
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useSharePointSites(search?: string) {
  const { loading: providerLoading } = useProvider()
  const cacheKey = `sharepoint:sites:${search || ""}`

  const fetcher = useCallback(async (): Promise<SharePointSite[]> => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    const res = await fetch(`/api/microsoft/sharepoint/sites?${params}`)
    if (!res.ok) throw new Error("Failed to fetch SharePoint sites")
    const json = await res.json()
    return json.sites ?? []
  }, [search])

  const { data, loading, error, refetch } = useCachedQuery<SharePointSite[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST, enabled: !providerLoading },
  )

  return { sites: data ?? [], loading: loading || providerLoading, error, refetch }
}

export function useSharePointDrives(siteId: string | null) {
  const { loading: providerLoading } = useProvider()
  const cacheKey = siteId ? `sharepoint:drives:${siteId}` : null

  const fetcher = useCallback(async (): Promise<SharePointDrive[]> => {
    const res = await fetch(`/api/microsoft/sharepoint/sites/${siteId}/drives`)
    if (!res.ok) throw new Error("Failed to fetch drives")
    const json = await res.json()
    return json.drives ?? []
  }, [siteId])

  const { data, loading, error, refetch } = useCachedQuery<SharePointDrive[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST, enabled: !providerLoading },
  )

  return { drives: data ?? [], loading: loading || providerLoading, error, refetch }
}

export function useSharePointDriveItems(
  siteId: string | null,
  driveId: string | null,
  folderId?: string,
) {
  const { loading: providerLoading } = useProvider()
  const cacheKey =
    siteId && driveId
      ? `sharepoint:drive-items:${siteId}:${driveId}:${folderId || "root"}`
      : null

  const fetcher = useCallback(async (): Promise<SharePointDriveItem[]> => {
    const params = new URLSearchParams()
    if (folderId) params.set("folderId", folderId)
    const res = await fetch(
      `/api/microsoft/sharepoint/sites/${siteId}/drives/${driveId}/items?${params}`,
    )
    if (!res.ok) throw new Error("Failed to fetch drive items")
    const json = await res.json()
    return json.items ?? []
  }, [siteId, driveId, folderId])

  const { data, loading, error, refetch } = useCachedQuery<SharePointDriveItem[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST, enabled: !providerLoading },
  )

  return { items: data ?? [], loading: loading || providerLoading, error, refetch }
}

export function useSharePointLists(siteId: string | null) {
  const { loading: providerLoading } = useProvider()
  const cacheKey = siteId ? `sharepoint:lists:${siteId}` : null

  const fetcher = useCallback(async (): Promise<SharePointList[]> => {
    const res = await fetch(`/api/microsoft/sharepoint/sites/${siteId}/lists`)
    if (!res.ok) throw new Error("Failed to fetch lists")
    const json = await res.json()
    return json.lists ?? []
  }, [siteId])

  const { data, loading, error, refetch } = useCachedQuery<SharePointList[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST, enabled: !providerLoading },
  )

  return { lists: data ?? [], loading: loading || providerLoading, error, refetch }
}

export function useSharePointListItems(siteId: string | null, listId: string | null) {
  const { loading: providerLoading } = useProvider()
  const cacheKey =
    siteId && listId ? `sharepoint:list-items:${siteId}:${listId}` : null

  const fetcher = useCallback(async (): Promise<{
    items: SharePointListItem[]
    columns: SharePointListColumn[]
  }> => {
    const res = await fetch(
      `/api/microsoft/sharepoint/sites/${siteId}/lists/${listId}/items`,
    )
    if (!res.ok) throw new Error("Failed to fetch list items")
    const json = await res.json()
    return { items: json.items ?? [], columns: json.columns ?? [] }
  }, [siteId, listId])

  const { data, loading, error, refetch } = useCachedQuery<{
    items: SharePointListItem[]
    columns: SharePointListColumn[]
  }>(cacheKey, fetcher, { ttlMs: CACHE_TTL_LIST, enabled: !providerLoading })

  return {
    items: data?.items ?? [],
    columns: data?.columns ?? [],
    loading: loading || providerLoading,
    error,
    refetch,
  }
}
