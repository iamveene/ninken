import { NextResponse } from "next/server"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/copy">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    let body: { name?: string; folder?: string }
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const { name, folder } = body

    const drive = createDriveServiceFromToken(accessToken)
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
