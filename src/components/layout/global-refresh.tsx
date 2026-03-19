"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { cacheClear } from "@/lib/cache"
import { Button } from "@/components/ui/button"

export function GlobalRefreshButton() {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = useCallback(async () => {
    setSpinning(true)
    await cacheClear()
    router.refresh()
    setTimeout(() => setSpinning(false), 1000)
  }, [router])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleRefresh}
      aria-label="Refresh all data"
      title="Refresh all data"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
      />
    </Button>
  )
}
