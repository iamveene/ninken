"use client"

import { useState, useEffect, useCallback, useRef } from "react"

type TokenInfo = {
  valid: boolean
  expiresIn: number
  scopes: string[]
  email: string
  provider: string
  issuedAt: number
  error?: string
}

const POLL_INTERVAL = 30_000 // 30 seconds

export function useTokenInfo() {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedAtRef = useRef<number>(0)

  const fetchTokenInfo = useCallback(async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? "/api/auth/token-info?refresh=true" : "/api/auth/token-info"
      const res = await fetch(url)
      if (!res.ok) {
        setError("Failed to fetch token info")
        return
      }
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
      fetchedAtRef.current = Date.now()
      setError(null)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokenInfo()
    const interval = setInterval(() => fetchTokenInfo(), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchTokenInfo])

  // Compute live countdown based on when we fetched
  const getExpiresIn = useCallback(() => {
    if (!tokenInfo?.valid || !tokenInfo.expiresIn) return 0
    const elapsed = Math.floor((Date.now() - fetchedAtRef.current) / 1000)
    return Math.max(0, tokenInfo.expiresIn - elapsed)
  }, [tokenInfo])

  const refresh = useCallback(() => fetchTokenInfo(true), [fetchTokenInfo])

  return { tokenInfo, loading, error, refresh, getExpiresIn }
}
