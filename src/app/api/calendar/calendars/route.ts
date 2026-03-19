import { NextResponse } from "next/server"
import { createCalendarService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const calendar = createCalendarService(token)
    const res = await calendar.calendarList.list()

    return NextResponse.json({
      calendars: res.data.items || [],
    })
  } catch (error) {
    return serverError(error)
  }
}
