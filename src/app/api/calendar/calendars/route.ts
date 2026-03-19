import { NextResponse } from "next/server"
import { createCalendarServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const calendar = createCalendarServiceFromToken(accessToken)
    const res = await calendar.calendarList.list()

    return NextResponse.json({
      calendars: res.data.items || [],
    })
  } catch (error) {
    return serverError(error)
  }
}
