"use client"

import { useState, useEffect, useCallback } from "react"
import { Database } from "lucide-react"
import { getCacheSize, cacheClear, emitGlobalRefresh } from "@/lib/cache"
import { Button } from "@/components/ui/button"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CacheIndicator() {
  const [size, setSize] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setSize(await getCacheSize())
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleClear = async () => {
    await cacheClear()
    emitGlobalRefresh()
    setSize(0)
  }

  return (
    <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Database className="h-3 w-3" />
        <span>{formatBytes(size)}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleClear}
      >
        Clear cache
      </Button>
    </div>
  )
}
