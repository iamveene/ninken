"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"
import { getQueueSize } from "@/lib/offline-queue"

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [showBackOnline, setShowBackOnline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    setIsOffline(!navigator.onLine)

    const handleOffline = () => {
      setIsOffline(true)
      setShowBackOnline(false)
    }

    const handleOnline = () => {
      setIsOffline(false)
      setShowBackOnline(true)
      setTimeout(() => setShowBackOnline(false), 3000)
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  useEffect(() => {
    if (!isOffline) return
    let cancelled = false
    const check = async () => {
      try {
        const size = await getQueueSize()
        if (!cancelled) setQueueCount(size)
      } catch {}
    }
    check()
    const interval = setInterval(check, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isOffline])

  if (!isOffline && !showBackOnline) return null

  if (showBackOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-900/50 dark:text-green-200">
        Back online
      </div>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
      <WifiOff className="h-4 w-4" />
      <span>You&apos;re offline &mdash; showing cached data</span>
      {queueCount > 0 && (
        <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium dark:bg-amber-800">
          {queueCount} pending {queueCount === 1 ? "action" : "actions"}
        </span>
      )}
    </div>
  )
}
