"use client"

import { useState, useEffect, useCallback } from "react"
import type { CustomPattern } from "@/lib/tools/custom-pattern-store"

export function useCustomPatterns() {
  const [patterns, setPatterns] = useState<CustomPattern[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { getAllCustomPatterns } = await import("@/lib/tools/custom-pattern-store")
    const all = await getAllCustomPatterns()
    setPatterns(all.sort((a, b) => b.createdAt - a.createdAt))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const add = useCallback(
    async (pattern: Omit<CustomPattern, "id" | "createdAt" | "updatedAt">) => {
      const { addCustomPattern } = await import("@/lib/tools/custom-pattern-store")
      await addCustomPattern(pattern)
      await reload()
    },
    [reload]
  )

  const remove = useCallback(
    async (id: string) => {
      const { removeCustomPattern } = await import("@/lib/tools/custom-pattern-store")
      await removeCustomPattern(id)
      await reload()
    },
    [reload]
  )

  const update = useCallback(
    async (id: string, updates: Partial<Omit<CustomPattern, "id" | "createdAt">>) => {
      const { updateCustomPattern } = await import("@/lib/tools/custom-pattern-store")
      await updateCustomPattern(id, updates)
      await reload()
    },
    [reload]
  )

  return { patterns, loading, add, remove, update, reload }
}
