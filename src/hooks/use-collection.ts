"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getAllItems,
  getStats,
  removeItem as storeRemoveItem,
  clearCollection as storeClearCollection,
  updateItem,
  type CollectionItem,
  type CollectionStats,
  type CollectionItemStatus,
  type CollectionSource,
  type CollectionItemType,
} from "@/lib/collection-store"
import { getCollectionManager } from "@/lib/collection-manager"

const POLL_INTERVAL = 3_000

export function useCollection(options?: {
  status?: CollectionItemStatus
  source?: CollectionSource
  type?: CollectionItemType
  limit?: number
}) {
  const [items, setItems] = useState<CollectionItem[]>([])
  const [stats, setStats] = useState<CollectionStats>({
    total: 0,
    pending: 0,
    downloading: 0,
    done: 0,
    error: 0,
    totalBytes: 0,
  })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [fetchedItems, fetchedStats] = await Promise.all([
        getAllItems({
          status: options?.status,
          source: options?.source,
          type: options?.type,
          limit: options?.limit,
        }),
        getStats(),
      ])
      setItems(fetchedItems)
      setStats(fetchedStats)
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [options?.status, options?.source, options?.type, options?.limit])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)

    // Also listen to manager events for faster updates
    const manager = getCollectionManager()
    const unsub = manager.subscribe(() => {
      refresh()
    })

    return () => {
      clearInterval(interval)
      unsub()
    }
  }, [refresh])

  const removeItem = useCallback(
    async (id: string) => {
      await storeRemoveItem(id)
      await refresh()
    },
    [refresh]
  )

  const clearAll = useCallback(async () => {
    await storeClearCollection()
    await refresh()
  }, [refresh])

  const retryItem = useCallback(
    async (id: string) => {
      const manager = getCollectionManager()
      await manager.retryItem(id)
      await refresh()
    },
    [refresh]
  )

  const startQueue = useCallback(async () => {
    const manager = getCollectionManager()
    manager.startProcessing()
  }, [])

  const stopQueue = useCallback(() => {
    const manager = getCollectionManager()
    manager.stopProcessing()
  }, [])

  const retryAllErrors = useCallback(async () => {
    const errorItems = await getAllItems({ status: "error" })
    for (const item of errorItems) {
      await updateItem(item.id, { status: "pending", retries: 0, error: undefined })
    }
    await refresh()
    const manager = getCollectionManager()
    if (!manager.isProcessing) {
      manager.startProcessing()
    }
  }, [refresh])

  return {
    items,
    stats,
    loading,
    removeItem,
    clearAll,
    retryItem,
    retryAllErrors,
    startQueue,
    stopQueue,
    refresh,
  }
}
