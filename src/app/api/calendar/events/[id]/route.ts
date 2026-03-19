import { NextResponse } from "next/server"
import { createCalendarService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/calendar/events/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(request.url)
    const calendarId = searchParams.get("calendarId") || "primary"

    const calendar = createCalendarService(token)
    const res = await calendar.events.get({
      calendarId,
      eventId: id,
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/calendar/events/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { calendarId, summary, description, start, end, location } = body

    const calendar = createCalendarService(token)
    const res = await calendar.events.patch({
      calendarId: calendarId || "primary",
      eventId: id,
      requestBody: {
        summary: summary !== undefined ? summary : undefined,
        description: description !== undefined ? description : undefined,
        location: location !== undefined ? location : undefined,
        start: start || undefined,
        end: end || undefined,
      },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/calendar/events/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(request.url)
    const calendarId = searchParams.get("calendarId") || "primary"

    const calendar = createCalendarService(token)
    await calendar.events.delete({
      calendarId,
      eventId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error)
  }
}
