import { NextResponse } from "next/server"
import { createDriveService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const drive = createDriveService(token)
    const res = await drive.drives.list({
      pageSize: 100,
      fields: "drives(id, name, colorRgb, createdTime, backgroundImageLink)",
    })

    return NextResponse.json({
      drives: res.data.drives || [],
    })
  } catch (error) {
    return serverError(error)
  }
}
