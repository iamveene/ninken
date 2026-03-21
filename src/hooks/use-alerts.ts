"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getAlerts,
  getUnreadCount,
  addAlert as storeAddAlert,
  markAsRead as storeMarkAsRead,
  markAllAsRead as storeMarkAllAsRead,
  dismissAlert as storeDismissAlert,
  clearAlerts as storeClearAlerts,
  type Alert,
  type AlertCategory,
} from "@/lib/alert-store"

const POLL_INTERVAL = 10_000 // 10 seconds

export function useAlerts(options?: {
  limit?: number
  unreadOnly?: boolean
  category?: AlertCategory
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [fetched, count] = await Promise.all([
        getAlerts({
          limit: options?.limit,
          unreadOnly: options?.unreadOnly,
          category: options?.category,
        }),
        getUnreadCount(),
      ])
      setAlerts(fetched)
      setUnreadCount(count)
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [options?.limit, options?.unreadOnly, options?.category])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  const addAlertFn = useCallback(
    async (alert: Parameters<typeof storeAddAlert>[0]) => {
      await storeAddAlert(alert)
      await refresh()
    },
    [refresh]
  )

  const markAsRead = useCallback(
    async (id: string) => {
      await storeMarkAsRead(id)
      await refresh()
    },
    [refresh]
  )

  const markAllAsRead = useCallback(async () => {
    await storeMarkAllAsRead()
    await refresh()
  }, [refresh])

  const dismissAlertFn = useCallback(
    async (id: string) => {
      await storeDismissAlert(id)
      await refresh()
    },
    [refresh]
  )

  const clearAllAlerts = useCallback(async () => {
    await storeClearAlerts()
    await refresh()
  }, [refresh])

  return {
    alerts,
    unreadCount,
    loading,
    addAlert: addAlertFn,
    markAsRead,
    markAllAsRead,
    dismissAlert: dismissAlertFn,
    clearAlerts: clearAllAlerts,
    refresh,
  }
}
