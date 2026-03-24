"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CalendarEvent, CalendarEntry } from "@/hooks/use-calendar"

function toLocalDatetime(date: Date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  calendars,
  defaultStart,
  onSave,
  onDelete,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: CalendarEvent | null
  calendars: CalendarEntry[]
  defaultStart?: Date
  onSave: (data: {
    id?: string
    calendarId: string
    summary: string
    description: string
    location: string
    start: { dateTime: string; timeZone?: string }
    end: { dateTime: string; timeZone?: string }
  }) => void
  onDelete?: (id: string, calendarId: string) => void
  saving?: boolean
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = defaultStart || new Date()
  const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000)

  const [summary, setSummary] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [startTime, setStartTime] = useState(toLocalDatetime(now))
  const [endTime, setEndTime] = useState(toLocalDatetime(defaultEnd))
  const [calendarId, setCalendarId] = useState("primary")
  const [viewMode, setViewMode] = useState(false)

  useEffect(() => {
    if (!open) return
    if (event) {
      setViewMode(true) // OPSEC: start read-only for existing events
      setSummary(event.summary || "")
      setDescription(event.description || "")
      setLocation(event.location || "")
      setStartTime(
        event.start?.dateTime
          ? toLocalDatetime(new Date(event.start.dateTime))
          : toLocalDatetime(now)
      )
      setEndTime(
        event.end?.dateTime
          ? toLocalDatetime(new Date(event.end.dateTime))
          : toLocalDatetime(defaultEnd)
      )
      setCalendarId(event.calendarId || "primary")
    } else {
      setViewMode(false) // new events go directly to edit
      setSummary("")
      setDescription("")
      setLocation("")
      setStartTime(toLocalDatetime(defaultStart || new Date()))
      const end = new Date((defaultStart || new Date()).getTime() + 60 * 60 * 1000)
      setEndTime(toLocalDatetime(end))
      const primary = calendars.find((c) => c.primary)
      setCalendarId(primary?.id || calendars[0]?.id || "primary")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: event?.id,
      calendarId,
      summary,
      description,
      location,
      start: { dateTime: new Date(startTime).toISOString(), timeZone: tz },
      end: { dateTime: new Date(endTime).toISOString(), timeZone: tz },
    })
  }

  const writableCalendars = calendars.filter(
    (c) => c.accessRole === "owner" || c.accessRole === "writer"
  )

  const formatEventTime = (dt?: { dateTime?: string; date?: string }) => {
    if (dt?.dateTime) return new Date(dt.dateTime).toLocaleString()
    if (dt?.date) return new Date(dt.date).toLocaleDateString()
    return "Unknown"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {viewMode && event ? (
          <>
            <DialogHeader>
              <DialogTitle>{event.summary || "Untitled Event"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4 text-sm">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">When</span>
                <span>{formatEventTime(event.start)} — {formatEventTime(event.end)}</span>
              </div>
              {event.location && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Location</span>
                  <span>{event.location}</span>
                </div>
              )}
              {event.description && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Description</span>
                  <span className="whitespace-pre-wrap text-xs">{event.description}</span>
                </div>
              )}
              {event.organizer && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Organizer</span>
                  <span>{event.organizer.displayName || event.organizer.email}</span>
                </div>
              )}
              {event.status && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  <span className="capitalize">{event.status}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setViewMode(false)}>
                Edit
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="summary">Title</Label>
                <Input
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Add title"
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start">Start</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end">End</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description"
                  rows={3}
                />
              </div>
              {writableCalendars.length > 1 && (
                <div className="grid gap-2">
                  <Label>Calendar</Label>
                  <Select value={calendarId} onValueChange={(v) => { if (v) setCalendarId(v) }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {writableCalendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-2.5 rounded-full"
                              style={{ backgroundColor: cal.backgroundColor || "#4285f4" }}
                            />
                            {cal.summary}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              {event && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(event.id, calendarId)}
                  className="mr-auto"
                >
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !summary.trim()}>
                {saving ? "Saving..." : event ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
