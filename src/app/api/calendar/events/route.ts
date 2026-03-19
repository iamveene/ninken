import { NextResponse } from "next/server"
import { createCalendarServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const calendarId = searchParams.get("calendarId") || "primary"
    const timeMin = searchParams.get("timeMin") || undefined
    const timeMax = searchParams.get("timeMax") || undefined
    const maxResults = Math.min(Number(searchParams.get("maxResults")) || 250, 2500)

    const calendar = createCalendarServiceFromToken(accessToken)
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    })

    return NextResponse.json({
      events: res.data.items || [],
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const body = await request.json()
    const { calendarId, summary, description, start, end, location } = body

    if (!summary || !start || !end) {
      return badRequest("Missing required fields: summary, start, end")
    }

    const calendar = createCalendarServiceFromToken(accessToken)
    const res = await calendar.events.insert({
      calendarId: calendarId || "primary",
      requestBody: {
        summary,
        description: description || undefined,
        location: location || undefined,
        start,
        end,
      },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
