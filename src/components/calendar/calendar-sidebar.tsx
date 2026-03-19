"use client"

import { cn } from "@/lib/utils"
import type { CalendarEntry } from "@/hooks/use-calendar"

export function CalendarSidebar({
  calendars,
  enabledCalendars,
  onToggleCalendar,
  loading,
}: {
  calendars: CalendarEntry[]
  enabledCalendars: Set<string>
  onToggleCalendar: (id: string) => void
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 rounded bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  const owned = calendars.filter((c) => c.accessRole === "owner")
  const other = calendars.filter((c) => c.accessRole !== "owner")

  return (
    <div className="space-y-4 p-3">
      <CalendarGroup
        label="My calendars"
        calendars={owned}
        enabledCalendars={enabledCalendars}
        onToggle={onToggleCalendar}
      />
      {other.length > 0 && (
        <CalendarGroup
          label="Other calendars"
          calendars={other}
          enabledCalendars={enabledCalendars}
          onToggle={onToggleCalendar}
        />
      )}
    </div>
  )
}

function CalendarGroup({
  label,
  calendars,
  enabledCalendars,
  onToggle,
}: {
  label: string
  calendars: CalendarEntry[]
  enabledCalendars: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {calendars.map((cal) => {
          const enabled = enabledCalendars.has(cal.id)
          return (
            <button
              key={cal.id}
              onClick={() => onToggle(cal.id)}
              className={cn(
                "flex items-center gap-2 w-full rounded px-2 py-1 text-sm text-left hover:bg-muted/50 transition-colors"
              )}
            >
              <span
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                  enabled ? "border-transparent" : "border-muted-foreground/30"
                )}
                style={enabled ? { backgroundColor: cal.backgroundColor || "#4285f4" } : {}}
              >
                {enabled && (
                  <svg className="size-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="truncate">{cal.summary}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
