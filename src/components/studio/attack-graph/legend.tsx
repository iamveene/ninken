"use client"

import {
  ALL_ENTITY_TYPES,
  ALL_RELATION_TYPES,
  ENTITY_LABELS,
  ENTITY_COLORS,
  RELATION_LABELS,
  RELATION_DASH,
} from "@/lib/studio/graph-types"

export function Legend() {
  return (
    <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm border border-border/40 rounded-md p-2.5 text-xs space-y-2 pointer-events-auto">
      {/* Entity types */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {ALL_ENTITY_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ENTITY_COLORS[t] }}
            />
            <span className="text-muted-foreground">{ENTITY_LABELS[t]}</span>
          </span>
        ))}
      </div>

      {/* Relation types */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {ALL_RELATION_TYPES.map((t) => {
          const dash = RELATION_DASH[t]
          return (
            <span key={t} className="flex items-center gap-1.5">
              <svg width="20" height="8" className="shrink-0">
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke="currentColor"
                  strokeWidth={t === "admin-of" ? 2 : 1.5}
                  strokeDasharray={dash === "none" ? undefined : dash}
                  className="text-muted-foreground"
                />
              </svg>
              <span className="text-muted-foreground">{RELATION_LABELS[t]}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
