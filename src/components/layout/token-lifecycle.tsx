"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Shield, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTokenInfo } from "@/hooks/use-token-info"

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Expired"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `${hours}h ${remainingMins}m`
}

function getStatusColor(seconds: number): string {
  if (seconds <= 0) return "text-red-500"
  if (seconds < 600) return "text-red-400" // < 10 min
  if (seconds < 1800) return "text-amber-400" // < 30 min
  return "text-emerald-400"
}

function getDotColor(seconds: number): string {
  if (seconds <= 0) return "bg-red-500"
  if (seconds < 600) return "bg-red-400"
  if (seconds < 1800) return "bg-amber-400"
  return "bg-emerald-400"
}

export function TokenLifecycle() {
  const { tokenInfo, loading, refresh, getExpiresIn } = useTokenInfo()
  const [expiresIn, setExpiresIn] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Update countdown every second
  useEffect(() => {
    setExpiresIn(getExpiresIn())
    const interval = setInterval(() => setExpiresIn(getExpiresIn()), 1000)
    return () => clearInterval(interval)
  }, [getExpiresIn])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading || !tokenInfo) {
    return (
      <div className="group-data-[collapsible=icon]:hidden px-2 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (!tokenInfo.valid) {
    return (
      <div className="group-data-[collapsible=icon]:hidden px-2 py-1.5">
        <div className="flex items-center gap-2 text-xs text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span>Token invalid</span>
        </div>
      </div>
    )
  }

  const scopeCount = tokenInfo.scopes?.length ?? 0
  const isPat = tokenInfo.expiresIn === 0 || !tokenInfo.expiresIn

  return (
    <div className="group-data-[collapsible=icon]:hidden px-2 py-1.5 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isPat ? "bg-emerald-400" : getDotColor(expiresIn))} />
          {isPat ? (
            <span className="text-xs text-emerald-400">PAT active</span>
          ) : (
            <>
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={cn("text-xs font-mono tabular-nums", getStatusColor(expiresIn))}>
                {formatCountdown(expiresIn)}
              </span>
            </>
          )}
        </div>
        {!isPat && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh token"
          >
            <RefreshCw className={cn("h-3 w-3 text-muted-foreground", refreshing && "animate-spin")} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Shield className="h-2.5 w-2.5" />
        <span>{scopeCount} scope{scopeCount !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}
