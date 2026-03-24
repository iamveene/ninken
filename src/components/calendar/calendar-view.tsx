"use client"

import { useMemo } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { EventCard } from "./event-card"
import type { CalendarEvent, CalendarEntry } from "@/hooks/use-calendar"

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7am to 10pm

function getWeekDays(date: Date): Date[] {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isToday(date: Date) {
  return isSameDay(date, new Date())
}

function getEventPosition(event: CalendarEvent) {
  const start = event.start?.dateTime ? new Date(event.start.dateTime) : null
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : null
  if (!start || !end) return null

  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const topMinutes = Math.max(startMinutes - 7 * 60, 0) // offset from 7am
  const durationMinutes = Math.max(endMinutes - startMinutes, 15)

  return {
    top: (topMinutes / 60) * 48, // 48px per hour
    height: Math.max((durationMinutes / 60) * 48, 18),
  }
}

export function CalendarView({
  weekStart,
  events,
  calendars,
  onSlotClick,
  onEventClick,
  onPrevWeek,
  onNextWeek,
  onToday,
  loading,
}: {
  weekStart: Date
  events: CalendarEvent[]
  calendars: CalendarEntry[]
  onSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  loading?: boolean
}) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart])

  const calendarColors = useMemo(() => {
    const map = new Map<string, string>()
    calendars.forEach((c) => map.set(c.id, c.backgroundColor || "#4285f4"))
    return map
  }, [calendars])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    days.forEach((d) => map.set(d.toDateString(), []))

    events.forEach((event) => {
      const startStr = event.start?.dateTime || event.start?.date
      if (!startStr) return
      const startDate = new Date(startStr)
      const key = startDate.toDateString()
      const dayEvents = map.get(key)
      if (dayEvents) dayEvents.push(event)
    })

    return map
  }, [events, days])

  const monthLabel = useMemo(() => {
    const first = days[0]
    const last = days[6]
    const fmtMonth = (d: Date) => d.toLocaleDateString(undefined, { month: "long" })
    const fmtYear = (d: Date) => d.getFullYear()

    if (first.getMonth() === last.getMonth()) {
      return `${fmtMonth(first)} ${fmtYear(first)}`
    }
    if (first.getFullYear() === last.getFullYear()) {
      return `${fmtMonth(first)} - ${fmtMonth(last)} ${fmtYear(first)}`
    }
    return `${fmtMonth(first)} ${fmtYear(first)} - ${fmtMonth(last)} ${fmtYear(last)}`
  }, [days])

  return (
    <div className="flex flex-col h-full">
      {/* Header nav */}
      <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        <h2 className="text-lg font-semibold min-w-[200px]">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevWeek}
            className="rounded p-1 hover:bg-muted transition-colors"
            aria-label="Previous week"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={onToday}
            className="rounded px-2.5 py-0.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={onNextWeek}
            className="rounded p-1 hover:bg-muted transition-colors"
            aria-label="Next week"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {loading && (
          <div className="ml-2 size-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      {/* Day headers */}
      <div className="grid shrink-0 border-b" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        <div className="border-r" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "py-2 text-center border-r last:border-r-0",
              isToday(day) && "bg-primary/5"
            )}
          >
            <div className="text-xs text-muted-foreground">
              {day.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div
              className={cn(
                "text-lg font-semibold leading-tight",
                isToday(day) &&
                  "inline-flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground"
              )}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto relative">
        {!loading && events.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm">No events this week</p>
            </div>
          </div>
        )}
        <div className="grid relative" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          {/* Time labels */}
          <div className="border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-12 text-[10px] text-muted-foreground text-right pr-2 pt-[-6px] relative"
              >
                <span className="absolute -top-2 right-2">
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayEvents = eventsByDay.get(day.toDateString()) || []
            return (
              <div
                key={day.toISOString()}
                className={cn("relative border-r last:border-r-0", isToday(day) && "bg-primary/[0.02]")}
              >
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-12 border-b border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => {
                      const clickDate = new Date(day)
                      clickDate.setHours(hour, 0, 0, 0)
                      onSlotClick(clickDate)
                    }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const pos = getEventPosition(event)
                  if (!pos) return null
                  return (
                    <div
                      key={event.id}
                      className="absolute left-0.5 right-0.5 z-10"
                      style={{ top: pos.top, height: pos.height }}
                    >
                      <EventCard
                        event={event}
                        color={calendarColors.get(event.calendarId || "")}
                        compact={pos.height < 30}
                        onClick={() => onEventClick(event)}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
