"use client"

import { Shield, CheckCircle2, Loader2, XCircle, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ServiceQueryStatus } from "@/lib/audit/query-types"

const STATUS_CONFIG = {
  idle: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/50" },
  loading: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
} as const

type StealthIndicatorProps = {
  statuses: ServiceQueryStatus[]
  totalDurationMs?: number
  totalResults?: number
}

export function StealthIndicator({
  statuses,
  totalDurationMs,
  totalResults,
}: StealthIndicatorProps) {
  if (statuses.length === 0) return null

  const loading = statuses.filter((s) => s.status === "loading").length
  const succeeded = statuses.filter((s) => s.status === "success").length
  const errored = statuses.filter((s) => s.status === "error").length
  const isActive = loading > 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Shield className={`h-3.5 w-3.5 ${isActive ? "text-blue-400" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">
          {isActive
            ? `Querying ${loading} service${loading > 1 ? "s" : ""}...`
            : `${succeeded + errored}/${statuses.length} services queried`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {statuses.map((s) => {
          const config = STATUS_CONFIG[s.status]
          const Icon = config.icon
          return (
            <Badge
              key={s.service}
              variant="secondary"
              className={`text-[10px] ${config.bg} ${config.color} border-transparent gap-1`}
              title={s.error || s.service}
            >
              <Icon className={`h-2.5 w-2.5 ${s.status === "loading" ? "animate-spin" : ""}`} />
              {s.service}
            </Badge>
          )
        })}
      </div>

      {totalDurationMs != null && !isActive && (
        <span className="text-xs text-muted-foreground">
          {(totalDurationMs / 1000).toFixed(1)}s
        </span>
      )}

      {totalResults != null && totalResults > 0 && !isActive && (
        <Badge variant="secondary" className="text-[10px]">
          {totalResults} result{totalResults !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  )
}
