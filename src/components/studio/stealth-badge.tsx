"use client"

import { cn } from "@/lib/utils"
import { getStealthTier, getStealthColorClass, type StealthLevel } from "@/lib/studio/stealth-scores"

interface StealthBadgeProps {
  level: StealthLevel
  showLabel?: boolean
  size?: "sm" | "md"
  className?: string
}

export function StealthBadge({ level, showLabel = true, size = "sm", className }: StealthBadgeProps) {
  const tier = getStealthTier(level)
  const colors = getStealthColorClass(level)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-mono",
        colors.badge,
        colors.border,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className
      )}
    >
      <span className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "inline-block rounded-full",
              size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5",
              i < level ? colors.text.replace("text-", "bg-") : "bg-muted-foreground/20"
            )}
          />
        ))}
      </span>
      {showLabel && (
        <span className="uppercase tracking-wider">{tier.codename}</span>
      )}
    </span>
  )
}
