"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getAllVaultItems,
  addVaultItem as storeAddItem,
  deleteVaultItem as storeDeleteItem,
  clearAllVaultItems as storeClearAll,
  getVaultStats,
} from "@/lib/vault-store"
import type { VaultItem, VaultStats } from "@/lib/vault/types"

export function useVault() {
  const [items, setItems] = useState<VaultItem[]>([])
  const [stats, setStats] = useState<VaultStats>({
    total: 0,
    byType: {},
    byProvider: {},
    reinjected: 0,
  })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [fetchedItems, fetchedStats] = await Promise.all([
        getAllVaultItems(),
        getVaultStats(),
      ])
      setItems(fetchedItems)
      setStats(fetchedStats)
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addItem = useCallback(
    async (item: VaultItem) => {
      const result = await storeAddItem(item)
      await refresh()
      return result
    },
    [refresh]
  )

  const removeItem = useCallback(
    async (id: string) => {
      await storeDeleteItem(id)
      await refresh()
    },
    [refresh]
  )

  const clearAll = useCallback(async () => {
    await storeClearAll()
    await refresh()
  }, [refresh])

  return {
    items,
    stats,
    loading,
    addItem,
    removeItem,
    clearAll,
    refresh,
  }
}
