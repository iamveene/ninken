"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { AlertCircle } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { CalendarView } from "@/components/calendar/calendar-view"
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar"
import { EventDialog } from "@/components/calendar/event-dialog"
import { SidebarSlotContent } from "@/components/sidebar-slot"
import {
  useCalendars,
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/hooks/use-calendar"
import type { CalendarEvent } from "@/hooks/use-calendar"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"


function getWeekBounds(date: Date) {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 7)
  sunday.setHours(0, 0, 0, 0)

  return { start: monday, end: sunday }
}

export default function CalendarPage() {
  const isMobile = useIsMobile()
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const [enabledCalendars, setEnabledCalendars] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [defaultStart, setDefaultStart] = useState<Date | undefined>()

  const { data: calendars, loading: calendarsLoading, error: calendarsError } = useCalendars()

  // Auto-enable all calendars on first load
  useEffect(() => {
    if (!initialized && calendars.length > 0) {
      setEnabledCalendars(new Set(calendars.map((c) => c.id)))
      setInitialized(true)
    }
  }, [initialized, calendars])

  const bounds = useMemo(() => getWeekBounds(weekStart), [weekStart])
  const enabledIds = useMemo(() => Array.from(enabledCalendars), [enabledCalendars])

  const { data: events, loading: eventsLoading, refetch } = useEvents(
    enabledIds,
    bounds.start.toISOString(),
    bounds.end.toISOString()
  )

  const { create, loading: creating } = useCreateEvent()
  const { update, loading: updating } = useUpdateEvent()
  const { remove } = useDeleteEvent()

  const handleToggleCalendar = useCallback((id: string) => {
    setEnabledCalendars((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }, [])

  const handleToday = useCallback(() => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    setWeekStart(monday)
  }, [])

  const handleSlotClick = useCallback((date: Date) => {
    setSelectedEvent(null)
    setDefaultStart(date)
    setDialogOpen(true)
  }, [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setDefaultStart(undefined)
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(
    async (data: {
      id?: string
      calendarId: string
      summary: string
      description: string
      location: string
      start: { dateTime: string; timeZone?: string }
      end: { dateTime: string; timeZone?: string }
    }) => {
      if (data.id) {
        await update(data.id, {
          calendarId: data.calendarId,
          summary: data.summary,
          description: data.description,
          location: data.location,
          start: data.start,
          end: data.end,
        })
      } else {
        await create({
          calendarId: data.calendarId,
          summary: data.summary,
          description: data.description,
          location: data.location,
          start: data.start,
          end: data.end,
        })
      }
      setDialogOpen(false)
      refetch()
    },
    [create, update, refetch]
  )

  const handleDelete = useCallback(
    async (id: string, calendarId: string) => {
      await remove(id, calendarId)
      setDialogOpen(false)
      refetch()
    },
    [remove, refetch]
  )

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background">
      {isMobile ? (
        <div className="flex-1 min-w-0 flex flex-col">
          {calendarsError && (
            <CalendarError error={calendarsError} />
          )}
          <CalendarView
            weekStart={weekStart}
            events={events}
            calendars={calendars}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onToday={handleToday}
            loading={eventsLoading}
          />
        </div>
      ) : (
        <>
          <SidebarSlotContent>
            <CalendarSidebar
              calendars={calendars}
              enabledCalendars={enabledCalendars}
              onToggleCalendar={handleToggleCalendar}
              loading={calendarsLoading}
            />
          </SidebarSlotContent>
          <div className="flex-1 min-w-0 flex flex-col h-full">
            {calendarsError && (
              <CalendarError error={calendarsError} />
            )}
            <CalendarView
              weekStart={weekStart}
              events={events}
              calendars={calendars}
              onSlotClick={handleSlotClick}
              onEventClick={handleEventClick}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onToday={handleToday}
              loading={eventsLoading}
            />
          </div>
        </>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        calendars={calendars}
        defaultStart={defaultStart}
        onSave={handleSave}
        onDelete={handleDelete}
        saving={creating || updating}
      />
    </div>
  )
}

function CalendarError({ error }: { error: string }) {
  return (
    <div className="px-4 pt-3">
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Unable to load calendars
          </CardTitle>
          <CardDescription>
            {error.includes("403") || error.includes("Forbidden") || error.includes("insufficient") || error.includes("scope")
              ? "Calendar access requires additional permissions. Please re-authenticate with Calendar scope enabled."
              : error}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
