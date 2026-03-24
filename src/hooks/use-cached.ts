"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cacheGet, cacheSet, CACHE_TTL_LIST, onGlobalRefresh } from "@/lib/cache"

type UseCachedOptions = {
  ttlMs?: number
  staleWhileRevalidate?: boolean
  enabled?: boolean
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: UseCachedOptions
): {
  data: T | null
  loading: boolean
  error: string | null
  stale: boolean
  refetch: () => Promise<void>
} {
  const { ttlMs = CACHE_TTL_LIST, staleWhileRevalidate = true, enabled = true } = options ?? {}

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const doFetch = useCallback(async (ignoreCache = false) => {
    if (!key || !enabled) {
      setData(null)
      setLoading(false)
      return
    }

    setError(null)

    if (!ignoreCache) {
      try {
        const cached = await cacheGet<T>(key)
        if (cached && mountedRef.current) {
          setData(cached.data)
          setStale(cached.stale)
          setLoading(false)
          if (!cached.stale && !staleWhileRevalidate) return
          if (!cached.stale) {
            // Fresh cache, but staleWhileRevalidate means we still revalidate
          }
        }
      } catch {
        // Cache miss, proceed to fetch
      }
    }

    try {
      const result = await fetcher()
      if (!mountedRef.current) return
      setData(result)
      setStale(false)
      setError(null)
      await cacheSet(key, result, ttlMs)
    } catch (err) {
      if (!mountedRef.current) return
      if (data !== null) {
        setStale(true)
      } else {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [key, enabled, fetcher, ttlMs, staleWhileRevalidate, data])

  useEffect(() => {
    setLoading(true)
    doFetch()
  }, [key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(async () => {
    setLoading(true)
    await doFetch(true)
  }, [doFetch])

  // Subscribe to global refresh signal — refetch when triggered
  useEffect(() => {
    return onGlobalRefresh(() => {
      doFetch(true)
    })
  }, [doFetch])

  return { data, loading, error, stale, refetch }
}
