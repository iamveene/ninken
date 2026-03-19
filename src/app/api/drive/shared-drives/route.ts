import { NextRequest, NextResponse } from "next/server"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export async function GET(request: NextRequest) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const pageToken = request.nextUrl.searchParams.get("pageToken") || undefined
    const drive = createDriveServiceFromToken(accessToken)
    const res = await drive.drives.list({
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, drives(id, name, colorRgb, createdTime, backgroundImageLink)",
    })

    return NextResponse.json({
      drives: res.data.drives || [],
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}
