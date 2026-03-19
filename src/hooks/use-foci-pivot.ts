"use client"

import { useState, useCallback } from "react"

export type FociPivotResult = {
  clientId: string
  clientName: string
  success: boolean
  scopes: string[]
  error?: string
}

export type FociPivotResponse = {
  credentialClientId: string
  results: FociPivotResult[]
  uniqueScopes: string[]
  scopeMatrix: Record<string, string[]>
}

export function useFociPivot() {
  const [results, setResults] = useState<FociPivotResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const probe = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch("/api/microsoft/audit/foci-pivot", {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error || `FOCI pivot probe failed (${res.status})`
        )
      }

      const data: FociPivotResponse = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "FOCI pivot probe failed")
    } finally {
      setLoading(false)
    }
  }, [])

  return { results, loading, error, probe }
}
