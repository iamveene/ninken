import { NextResponse } from "next/server"
import { createDriveService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../../_helpers"

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/copy">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    let body: { name?: string; folder?: string }
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const { name, folder } = body

    const drive = createDriveService(token)
    const res = await drive.files.copy({
      fileId: id,
      requestBody: {
        name: name || undefined,
        parents: folder ? [folder] : undefined,
      },
      fields: "id, name, mimeType, size, modifiedTime, webViewLink",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
