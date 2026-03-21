"use client"

import { useState, useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type CalendarEntry = {
  id: string
  summary: string
  description?: string
  backgroundColor?: string
  foregroundColor?: string
  primary?: boolean
  selected?: boolean
  accessRole?: string
}

export type CalendarEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  status?: string
  htmlLink?: string
  creator?: { email?: string; displayName?: string }
  organizer?: { email?: string; displayName?: string }
  colorId?: string
  calendarId?: string
}

export function useCalendars() {
  const fetcher = useCallback(async (): Promise<CalendarEntry[]> => {
    const res = await fetch("/api/calendar/calendars")
    if (!res.ok) throw new Error("Failed to fetch calendars")
    const json = await res.json()
    return json.calendars ?? []
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<CalendarEntry[]>(
    "calendar:calendars",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { data: data ?? [], loading, error, refetch }
}

export function useEvents(calendarIds: string[], timeMin?: string, timeMax?: string) {
  const key = calendarIds.length > 0
    ? `calendar:events:${calendarIds.sort().join(",")}:${timeMin}:${timeMax}`
    : null

  const fetcher = useCallback(async (): Promise<CalendarEvent[]> => {
    const allEvents: CalendarEvent[] = []
    await Promise.all(
      calendarIds.map(async (calendarId) => {
        const params = new URLSearchParams({ calendarId })
        if (timeMin) params.set("timeMin", timeMin)
        if (timeMax) params.set("timeMax", timeMax)
        const res = await fetch(`/api/calendar/events?${params}`)
        if (!res.ok) return
        const json = await res.json()
        const events = (json.events ?? []).map((e: CalendarEvent) => ({
          ...e,
          calendarId,
        }))
        allEvents.push(...events)
      })
    )
    return allEvents
  }, [calendarIds, timeMin, timeMax])

  const { data, loading, error, refetch } = useCachedQuery<CalendarEvent[]>(
    key,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return { data: data ?? [], loading, error, refetch }
}

export function useCreateEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(async (payload: {
    calendarId?: string
    summary: string
    description?: string
    location?: string
    start: { dateTime: string; timeZone?: string }
    end: { dateTime: string; timeZone?: string }
  }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create event")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(async (id: string, payload: {
    calendarId?: string
    summary?: string
    description?: string
    location?: string
    start?: { dateTime: string; timeZone?: string }
    end?: { dateTime: string; timeZone?: string }
  }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to update event")
      return await res.json()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useDeleteEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useCallback(async (id: string, calendarId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : ""
      const res = await fetch(`/api/calendar/events/${encodeURIComponent(id)}${params}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete event")
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { remove, loading, error }
}
