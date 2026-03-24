"use client"

import { useState, useCallback, useEffect } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST, CACHE_TTL_BODY } from "@/lib/cache"

export type GcpProject = {
  projectId: string
  name: string
  displayName?: string
  state?: string
  accessible?: boolean
  bucketCount?: number
  withObjectsCount?: number
}

export function useProjects() {
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [fetchError, setFetchError] = useState<boolean>(false)

  const fetcher = useCallback(async (): Promise<GcpProject[]> => {
    const res = await fetch("/api/gcp/projects")
    if (res.status === 403) {
      setFetchError(true)
      return []
    }
    if (!res.ok) throw new Error("Failed to fetch projects")
    const data = await res.json()
    return data.projects || []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<GcpProject[]>(
    "projects:list",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  const projects = data ?? []

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].projectId)
    }
  }, [projects, selectedProject])

  return {
    projects,
    loading,
    error,
    refetch,
    selectedProject,
    setSelectedProject,
    permissionDenied: fetchError,
  }
}

export type Bucket = {
  name: string
  location: string
  storageClass: string
  timeCreated: string
  updated?: string
  selfLink?: string
  hasObjects?: boolean
  readable?: boolean
  downloadable?: boolean
}

export type StorageObject = {
  name: string
  bucket: string
  contentType?: string
  size?: string
  timeCreated?: string
  updated?: string
  storageClass?: string
  md5Hash?: string
  crc32c?: string
  selfLink?: string
  mediaLink?: string
}

export type IamPolicy = {
  bindings?: { role: string; members: string[] }[]
  etag?: string
}

export function useBuckets(project: string) {
  const cacheKey = project ? `buckets:list:${project}` : null

  const fetcher = useCallback(async (): Promise<Bucket[]> => {
    const params = new URLSearchParams({ project })
    const res = await fetch(`/api/gcp/buckets?${params}`)
    if (!res.ok) throw new Error("Failed to fetch buckets")
    const data = await res.json()
    return data.buckets || []
  }, [project])

  const { data, loading, error, refetch } = useCachedQuery<Bucket[]>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { buckets: data ?? [], loading, error, refetch }
}

type ObjectsResult = {
  objects: StorageObject[]
  prefixes: string[]
  canDownload: boolean
}

export function useObjects(bucket: string, prefix?: string) {
  const cacheKey = bucket ? `buckets:objects:${bucket}:${prefix || ''}` : null

  const fetcher = useCallback(async (): Promise<ObjectsResult> => {
    const params = new URLSearchParams()
    if (prefix) params.set("prefix", prefix)
    const res = await fetch(`/api/gcp/buckets/${encodeURIComponent(bucket)}/objects?${params}`)
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Access denied")
    }
    if (!res.ok) throw new Error("Failed to fetch objects")
    const data = await res.json()
    return {
      objects: data.objects || [],
      prefixes: data.prefixes || [],
      canDownload: data.canDownload !== false,
    }
  }, [bucket, prefix])

  const { data, loading, error, refetch } = useCachedQuery<ObjectsResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    objects: data?.objects ?? [],
    prefixes: data?.prefixes ?? [],
    canDownload: data?.canDownload ?? true,
    loading,
    error,
    accessDenied: error?.includes("Access denied") || error?.includes("403") || false,
    refetch,
  }
}

export function useObjectMetadata(bucket: string, path: string | null) {
  const cacheKey = bucket && path ? `buckets:metadata:${bucket}:${path}` : null

  const fetcher = useCallback(async (): Promise<StorageObject> => {
    const res = await fetch(`/api/gcp/buckets/${encodeURIComponent(bucket)}/objects/metadata?path=${encodeURIComponent(path!)}`)
    if (!res.ok) throw new Error("Failed to fetch object metadata")
    return res.json()
  }, [bucket, path])

  const { data, loading, error } = useCachedQuery<StorageObject>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { metadata: data, loading, error }
}

export function useUploadObject() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File, bucket: string, prefix?: string) => {
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (prefix) formData.append("prefix", prefix)

      const xhr = new XMLHttpRequest()
      const result = await new Promise<StorageObject>((resolve, reject) => {
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
        xhr.open("POST", `/api/gcp/buckets/${encodeURIComponent(bucket)}/objects`)
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

export function useDownloadObject() {
  const download = useCallback((bucket: string, path: string) => {
    window.open(`/api/gcp/buckets/${encodeURIComponent(bucket)}/objects/download?path=${encodeURIComponent(path)}`, "_blank")
  }, [])

  return { download }
}

export function useBucketIam(bucket: string | null) {
  const cacheKey = bucket ? `buckets:iam:${bucket}` : null

  const fetcher = useCallback(async (): Promise<IamPolicy> => {
    const res = await fetch(`/api/gcp/buckets/${encodeURIComponent(bucket!)}/iam`)
    if (!res.ok) throw new Error("Failed to fetch IAM policy")
    return res.json()
  }, [bucket])

  const { data, loading, error } = useCachedQuery<IamPolicy>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_BODY }
  )

  return { policy: data, loading, error }
}
