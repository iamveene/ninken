"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

// ── Types ────────────────────────────────────────────────────────────

export type GcpKeyInfo = {
  projectId: string | null
  enabledApis: string[]
  keyPrefix: string
}

export type GcpFirestoreDatabase = {
  name: string
  uid: string
  type: string
  locationId: string
  concurrencyMode: string
  [key: string]: unknown
}

export type GcpFirestoreDocument = {
  name: string
  fields: Record<string, unknown>
  createTime: string
  updateTime: string
  [key: string]: unknown
}

export type GcpRtdbInstance = {
  name: string
  project: string
  databaseUrl: string
  type: string
  state: string
  [key: string]: unknown
}

export type GcpStorageBucket = {
  name: string
  id: string
  location: string
  storageClass: string
  timeCreated: string
  updated: string
  [key: string]: unknown
}

export type GcpStorageObject = {
  name: string
  bucket: string
  size: string
  contentType: string
  timeCreated: string
  updated: string
  [key: string]: unknown
}

export type GcpComputeInstance = {
  name: string
  zone: string
  machineType: string
  status: string
  networkInterfaces: { networkIP: string; accessConfigs?: { natIP: string }[] }[]
  _zone: string
  [key: string]: unknown
}

export type GcpComputeZone = {
  name: string
  description: string
  status: string
  region: string
  [key: string]: unknown
}

export type GcpVertexModel = {
  name: string
  displayName: string
  createTime: string
  updateTime: string
  [key: string]: unknown
}

export type GcpVertexEndpoint = {
  name: string
  displayName: string
  deployedModels: unknown[]
  createTime: string
  [key: string]: unknown
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useGcpKeyInfo() {
  const cacheKey = "gcp-key:info"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/gcp-key/me")
    if (!res.ok) return { projectId: null, enabledApis: [], keyPrefix: "" } as GcpKeyInfo
    return (await res.json()) as GcpKeyInfo
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: 5 * 60 * 1000,
  })

  return {
    info: data,
    loading,
    error,
    refetch,
  }
}

export function useGcpFirestoreDatabases(project?: string) {
  const cacheKey = project ? `gcp-key:firestore:databases:${project}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    const res = await fetch(`/api/gcp-key/firestore/databases?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Firestore databases")
    const json = await res.json()
    return { databases: (json.databases ?? []) as GcpFirestoreDatabase[] }
  }, [project])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    databases: data?.databases ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpFirestoreCollections(project?: string, database?: string) {
  const db = database ?? "(default)"
  const cacheKey = project ? `gcp-key:firestore:collections:${project}:${db}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    params.set("database", db)
    const res = await fetch(`/api/gcp-key/firestore/collections?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Firestore collections")
    const json = await res.json()
    return { collectionIds: (json.collectionIds ?? []) as string[] }
  }, [project, db])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    collectionIds: data?.collectionIds ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpFirestoreDocuments(
  project?: string,
  database?: string,
  collection?: string,
  pageSize?: number,
  pageToken?: string,
) {
  const db = database ?? "(default)"
  const cacheKey = project && collection
    ? `gcp-key:firestore:documents:${project}:${db}:${collection}:${pageSize ?? 50}:${pageToken ?? ""}`
    : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    params.set("database", db)
    if (collection) params.set("collection", collection)
    if (pageSize) params.set("pageSize", String(pageSize))
    if (pageToken) params.set("pageToken", pageToken)
    const res = await fetch(`/api/gcp-key/firestore/documents?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Firestore documents")
    const json = await res.json()
    return {
      documents: (json.documents ?? []) as GcpFirestoreDocument[],
      nextPageToken: (json.nextPageToken ?? null) as string | null,
    }
  }, [project, db, collection, pageSize, pageToken])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    documents: data?.documents ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    loading,
    error,
    refetch,
  }
}

export function useGcpRtdbInstances(project?: string) {
  const cacheKey = project ? `gcp-key:rtdb:instances:${project}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    const res = await fetch(`/api/gcp-key/rtdb/instances?${params}`)
    if (!res.ok) throw new Error("Failed to fetch RTDB instances")
    const json = await res.json()
    return { instances: (json.instances ?? []) as GcpRtdbInstance[] }
  }, [project])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    instances: data?.instances ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpRtdbData(instance?: string, path?: string) {
  const cacheKey = instance ? `gcp-key:rtdb:data:${instance}:${path ?? "/"}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (instance) params.set("instance", instance)
    if (path) params.set("path", path)
    const res = await fetch(`/api/gcp-key/rtdb/data?${params}`)
    if (!res.ok) throw new Error("Failed to fetch RTDB data")
    const json = await res.json()
    return { data: json.data }
  }, [instance, path])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    data: data?.data ?? null,
    loading,
    error,
    refetch,
  }
}

export function useGcpStorageBuckets(project?: string) {
  const cacheKey = project ? `gcp-key:storage:buckets:${project}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    const res = await fetch(`/api/gcp-key/storage/buckets?${params}`)
    if (!res.ok) throw new Error("Failed to fetch GCS buckets")
    const json = await res.json()
    return { buckets: (json.buckets ?? []) as GcpStorageBucket[] }
  }, [project])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    buckets: data?.buckets ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpStorageObjects(
  bucket?: string,
  prefix?: string,
  pageToken?: string,
) {
  const cacheKey = bucket ? `gcp-key:storage:objects:${bucket}:${prefix ?? ""}:${pageToken ?? ""}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (bucket) params.set("bucket", bucket)
    if (prefix) params.set("prefix", prefix)
    if (pageToken) params.set("pageToken", pageToken)
    const res = await fetch(`/api/gcp-key/storage/objects?${params}`)
    if (!res.ok) throw new Error("Failed to fetch GCS objects")
    const json = await res.json()
    return {
      objects: (json.objects ?? []) as GcpStorageObject[],
      prefixes: (json.prefixes ?? []) as string[],
      nextPageToken: (json.nextPageToken ?? null) as string | null,
    }
  }, [bucket, prefix, pageToken])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    objects: data?.objects ?? [],
    prefixes: data?.prefixes ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    loading,
    error,
    refetch,
  }
}

export function useGcpComputeInstances(project?: string) {
  const cacheKey = project ? `gcp-key:compute:instances:${project}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    const res = await fetch(`/api/gcp-key/compute/instances?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Compute instances")
    const json = await res.json()
    return { instances: (json.instances ?? []) as GcpComputeInstance[] }
  }, [project])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    instances: data?.instances ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpComputeZones(project?: string) {
  const cacheKey = project ? `gcp-key:compute:zones:${project}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    const res = await fetch(`/api/gcp-key/compute/zones?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Compute zones")
    const json = await res.json()
    return { zones: (json.zones ?? []) as GcpComputeZone[] }
  }, [project])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    zones: data?.zones ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpVertexModels(project?: string, region?: string) {
  const r = region ?? "us-central1"
  const cacheKey = project ? `gcp-key:vertexai:models:${project}:${r}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    params.set("region", r)
    const res = await fetch(`/api/gcp-key/vertexai/models?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Vertex AI models")
    const json = await res.json()
    return { models: (json.models ?? []) as GcpVertexModel[] }
  }, [project, r])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    models: data?.models ?? [],
    loading,
    error,
    refetch,
  }
}

export function useGcpVertexEndpoints(project?: string, region?: string) {
  const r = region ?? "us-central1"
  const cacheKey = project ? `gcp-key:vertexai:endpoints:${project}:${r}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (project) params.set("project", project)
    params.set("region", r)
    const res = await fetch(`/api/gcp-key/vertexai/endpoints?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Vertex AI endpoints")
    const json = await res.json()
    return { endpoints: (json.endpoints ?? []) as GcpVertexEndpoint[] }
  }, [project, r])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    endpoints: data?.endpoints ?? [],
    loading,
    error,
    refetch,
  }
}
