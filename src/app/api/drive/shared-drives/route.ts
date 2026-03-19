import { NextRequest, NextResponse } from "next/server"
import { createDriveService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET(request: NextRequest) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const pageToken = request.nextUrl.searchParams.get("pageToken") || undefined
    const drive = createDriveService(token)
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
