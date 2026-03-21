"use client"

import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@/hooks/use-calendar"

function getEventTime(event: CalendarEvent) {
  const start = event.start?.dateTime || event.start?.date
  const end = event.end?.dateTime || event.end?.date
  if (!start) return ""

  const startDate = new Date(start)
  const endDate = end ? new Date(end) : startDate

  if (!event.start?.dateTime) return "All day"

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  return `${fmt(startDate)} - ${fmt(endDate)}`
}

export function EventCard({
  event,
  color,
  compact,
  onClick,
}: {
  event: CalendarEvent
  color?: string
  compact?: boolean
  onClick?: () => void
}) {
  const bgColor = color || "#4285f4"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate border-0 cursor-pointer transition-opacity hover:opacity-80",
        compact ? "leading-tight" : "leading-normal"
      )}
      style={{
        backgroundColor: `${bgColor}20`,
        color: bgColor,
        borderLeft: `3px solid ${bgColor}`,
      }}
      title={`${event.summary || "(No title)"}\n${getEventTime(event)}`}
    >
      {!compact && (
        <span className="text-[10px] opacity-70 block">
          {getEventTime(event)}
        </span>
      )}
      <span className="truncate block">{event.summary || "(No title)"}</span>
    </button>
  )
}
