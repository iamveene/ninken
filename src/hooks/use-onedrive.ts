"use client"

import { useState, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type OneDriveItem = {
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
}

export function useOneDriveFiles(folderId?: string) {
  const cacheKey = `onedrive:files:${folderId || "root"}`

  const fetcher = useCallback(async (): Promise<OneDriveItem[]> => {
    const params = new URLSearchParams()
    if (folderId) params.set("folder", folderId)
    const res = await fetch(`/api/microsoft/drive/files?${params}`)
    if (!res.ok) throw new Error("Failed to fetch files")
    const json = await res.json()
    return json.files ?? []
  }, [folderId])

  const { data, loading, error, refetch } = useCachedQuery<OneDriveItem[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { files: data ?? [], loading, error, refetch }
}

export function useOneDriveSearch(query: string) {
  const cacheKey = query.trim() ? `onedrive:search:${query}` : null

  const fetcher = useCallback(async (): Promise<OneDriveItem[]> => {
    const params = new URLSearchParams({ term: query })
    const res = await fetch(`/api/microsoft/drive/search?${params}`)
    if (!res.ok) throw new Error("Failed to search files")
    const json = await res.json()
    return json.files ?? []
  }, [query])

  const { data, loading, error } = useCachedQuery<OneDriveItem[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { results: data ?? [], loading, error }
}

export function useOneDriveUpload() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (folderId: string | undefined, file: File) => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (folderId) formData.append("parent", folderId)
      const res = await fetch("/api/microsoft/drive/files", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Failed to upload file")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { upload, loading, error }
}

export function useOneDriveCreateFolder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createFolder = useCallback(async (parentId: string | undefined, name: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/microsoft/drive/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: parentId || "root", name }),
      })
      if (!res.ok) throw new Error("Failed to create folder")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { createFolder, loading, error }
}

export function useDeleteOneDriveItem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteItem = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/microsoft/drive/files/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete item")
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deleteItem, loading, error }
}
