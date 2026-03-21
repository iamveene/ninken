"use client"

import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/studio/scope-definitions"

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
}

const RISK_UNKNOWN = "bg-muted text-muted-foreground border-border/50"

interface ScopeTagProps {
  scope: string
  risk?: RiskLevel
  compact?: boolean
  className?: string
  onClick?: () => void
}

export function ScopeTag({ scope, risk, compact = false, className, onClick }: ScopeTagProps) {
  const colorClass = risk ? RISK_COLORS[risk] : RISK_UNKNOWN

  // Shorten Google scopes for display
  const displayScope = scope.replace("https://www.googleapis.com/auth/", "")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-mono",
        colorClass,
        compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {risk && (
        <span
          className={cn(
            "inline-block rounded-full",
            compact ? "h-1 w-1" : "h-1.5 w-1.5",
            risk === "low" && "bg-emerald-400",
            risk === "medium" && "bg-amber-400",
            risk === "high" && "bg-orange-400",
            risk === "critical" && "bg-red-400"
          )}
        />
      )}
      {displayScope}
    </span>
  )
}

interface RiskBadgeProps {
  risk: RiskLevel
  className?: string
}

export function RiskBadge({ risk, className }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
        RISK_COLORS[risk],
        className
      )}
    >
      {risk}
    </span>
  )
}
