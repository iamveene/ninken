"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  modifiedTime?: string
  owners?: { displayName: string; emailAddress: string; photoLink?: string }[]
  shared?: boolean
  starred?: boolean
  trashed?: boolean
  parents?: string[]
  webViewLink?: string
  webContentLink?: string
  iconLink?: string
  thumbnailLink?: string
  description?: string
  permissions?: DrivePermission[]
}

export type DrivePermission = {
  id: string
  type: string
  role: string
  emailAddress?: string
  displayName?: string
  photoLink?: string
  domain?: string
}

export type SortField = "name" | "modifiedTime" | "size"
export type SortDirection = "asc" | "desc"

export type SharedDrive = {
  id: string
  name: string
  colorRgb?: string
  createdTime?: string
  backgroundImageLink?: string
}

export function useFiles(folderId?: string, query?: string, limit = 50, driveId?: string) {
  const cacheKey = `drive:files:${driveId || 'my'}:${folderId || 'root'}:${query || ''}:${limit}`

  const fetcher = useCallback(async (): Promise<DriveFile[]> => {
    const params = new URLSearchParams()
    if (folderId) params.set("folder", folderId)
    if (query) params.set("q", query)
    if (driveId) params.set("driveId", driveId)
    params.set("limit", String(limit))
    const res = await fetch(`/api/drive/files?${params}`)
    if (!res.ok) throw new Error("Failed to fetch files")
    const data = await res.json()
    return data.files || []
  }, [folderId, query, limit, driveId])

  const { data, loading, error, refetch } = useCachedQuery<DriveFile[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { files: data ?? [], loading, error, refetch }
}

export function useFileInfo(id: string | null) {
  const cacheKey = id ? `drive:file:${id}` : null

  const fetcher = useCallback(async (): Promise<DriveFile> => {
    const res = await fetch(`/api/drive/files/${id}`)
    if (!res.ok) throw new Error("Failed to fetch file info")
    return res.json()
  }, [id])

  const { data, loading, error } = useCachedQuery<DriveFile>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { file: data, loading, error }
}

export function useUploadFile() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File, folderId?: string) => {
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (folderId) formData.append("parent", folderId)

      const xhr = new XMLHttpRequest()
      const result = await new Promise<DriveFile>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error("Upload failed"))
          }
        })
        xhr.addEventListener("error", () => reject(new Error("Upload failed")))
        xhr.open("POST", "/api/drive/files")
        xhr.send(formData)
      })
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  return { upload, uploading, progress, error }
}

export function useCreateFolder() {
  const [creating, setCreating] = useState(false)

  const createFolder = useCallback(async (name: string, parentId?: string) => {
    setCreating(true)
    try {
      const res = await fetch("/api/drive/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parent: parentId }),
      })
      if (!res.ok) throw new Error("Failed to create folder")
      return await res.json()
    } finally {
      setCreating(false)
    }
  }, [])

  return { createFolder, creating }
}

export function useRenameFile() {
  const rename = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/drive/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error("Failed to rename file")
    return await res.json()
  }, [])

  return { rename }
}

export function useMoveFile() {
  const move = useCallback(async (id: string, newParentId: string, oldParentId?: string) => {
    const res = await fetch(`/api/drive/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addParents: newParentId, removeParents: oldParentId }),
    })
    if (!res.ok) throw new Error("Failed to move file")
    return await res.json()
  }, [])

  return { move }
}

export function useCopyFile() {
  const copy = useCallback(async (id: string) => {
    const res = await fetch(`/api/drive/files/${id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error("Failed to copy file")
    return await res.json()
  }, [])

  return { copy }
}

export function useTrashFile() {
  const trash = useCallback(async (id: string) => {
    const res = await fetch(`/api/drive/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    })
    if (!res.ok) throw new Error("Failed to trash file")
    return await res.json()
  }, [])

  return { trash }
}

export function useDeleteFile() {
  const deleteFile = useCallback(async (id: string) => {
    const res = await fetch(`/api/drive/files/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete file")
  }, [])

  return { deleteFile }
}

export function useShareFile() {
  const share = useCallback(
    async (id: string, email: string, role: string, type = "user") => {
      const res = await fetch(`/api/drive/files/${id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, type }),
      })
      if (!res.ok) throw new Error("Failed to share file")
      return await res.json()
    },
    []
  )

  return { share }
}

export function usePermissions(id: string | null) {
  const [permissions, setPermissions] = useState<DrivePermission[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPermissions = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/drive/files/${id}/permissions`)
      if (!res.ok) throw new Error("Failed to fetch permissions")
      const data = await res.json()
      setPermissions(data.permissions || [])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const removePermission = useCallback(
    async (permissionId: string) => {
      if (!id) return
      const res = await fetch(`/api/drive/files/${id}/permissions/${permissionId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to remove permission")
      await fetchPermissions()
    },
    [id, fetchPermissions]
  )

  return { permissions, loading, refetch: fetchPermissions, removePermission }
}

export function useSharedDrives() {
  const cacheKey = "drive:shared-drives"

  const fetcher = useCallback(async (): Promise<SharedDrive[]> => {
    const res = await fetch("/api/drive/shared-drives")
    if (!res.ok) throw new Error("Failed to fetch shared drives")
    const data = await res.json()
    return data.drives || []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<SharedDrive[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { drives: data ?? [], loading, error, refetch }
}

export function useSearchFiles(term: string, type?: string) {
  const [debouncedTerm, setDebouncedTerm] = useState(term)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedTerm(term), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [term])

  const cacheKey = debouncedTerm.trim() ? `drive:search:${debouncedTerm}:${type || ''}` : null

  const fetcher = useCallback(async (): Promise<DriveFile[]> => {
    const params = new URLSearchParams({ term: debouncedTerm })
    if (type) params.set("type", type)
    const res = await fetch(`/api/drive/search?${params}`)
    if (!res.ok) throw new Error("Failed to search files")
    const data = await res.json()
    return data.files || []
  }, [debouncedTerm, type])

  const { data, loading, error } = useCachedQuery<DriveFile[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { results: data ?? [], loading, error }
}
