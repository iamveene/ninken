import { NextResponse } from "next/server"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../../_helpers"

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const body = await request.json()
    const { name, parent } = body

    if (!name) {
      return badRequest("Missing required field: name")
    }

    const drive = createDriveServiceFromToken(accessToken)
    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parent ? [parent] : undefined,
      },
      fields: "id, name, mimeType, modifiedTime, webViewLink",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
