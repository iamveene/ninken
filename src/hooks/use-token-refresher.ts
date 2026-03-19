"use client"

import { useState, useEffect, useCallback } from "react"
import {
  startTokenRefresher,
  stopTokenRefresher,
  getRefreshStatuses,
  setAutoRefresh as setAutoRefreshFn,
  refreshNow as refreshNowFn,
  onRefreshEvent,
  isRefresherRunning,
  type RefreshStatus,
} from "@/lib/token-refresher"

export function useTokenRefresher() {
  const [statuses, setStatuses] = useState<RefreshStatus[]>([])
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    // Subscribe to refresh events
    const unsubscribe = onRefreshEvent(() => {
      setStatuses(getRefreshStatuses())
    })

    setIsRunning(isRefresherRunning())
    setStatuses(getRefreshStatuses())

    return () => {
      unsubscribe()
    }
  }, [])

  const refreshNow = useCallback(async (profileId?: string) => {
    await refreshNowFn(profileId)
    setStatuses(getRefreshStatuses())
  }, [])

  const setAutoRefresh = useCallback((profileId: string, enabled: boolean) => {
    setAutoRefreshFn(profileId, enabled)
    setStatuses(getRefreshStatuses())
  }, [])

  return { statuses, isRunning, refreshNow, setAutoRefresh }
}
