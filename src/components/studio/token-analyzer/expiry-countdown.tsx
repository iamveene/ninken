"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Clock, AlertTriangle } from "lucide-react"

interface ExpiryCountdownProps {
  expiry: {
    issuedAt: Date | null
    expiresAt: Date | null
    notBefore: Date | null
    isExpired: boolean
    remainingSeconds: number | null
  }
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "EXPIRED"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(" ")
}

function formatDate(date: Date | null): string {
  if (!date) return "N/A"
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
}

export function ExpiryCountdown({ expiry }: ExpiryCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(expiry.remainingSeconds)

  useEffect(() => {
    if (remaining === null || remaining <= 0) return

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 0) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [remaining])

  const isExpired = remaining !== null && remaining <= 0
  const isWarning = remaining !== null && remaining > 0 && remaining < 300

  return (
    <Card className={cn(
      "border-border/50",
      isExpired && "border-red-500/30 bg-red-500/5",
      isWarning && "border-amber-500/30 bg-amber-500/5"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isExpired ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          Token Lifetime
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
            <div className={cn(
              "font-mono text-lg font-bold",
              isExpired ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
            )}>
              {remaining !== null ? formatDuration(remaining) : "Unknown"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
            <div className={cn(
              "text-sm font-medium",
              isExpired ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
            )}>
              {isExpired ? "Expired" : isWarning ? "Expiring Soon" : "Active"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Issued At</div>
            <div className="font-mono text-[11px] text-muted-foreground">{formatDate(expiry.issuedAt)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expires At</div>
            <div className="font-mono text-[11px] text-muted-foreground">{formatDate(expiry.expiresAt)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
