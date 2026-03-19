import { NextResponse } from "next/server"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

const TYPE_MIME_MAP: Record<string, string> = {
  document: "application/vnd.google-apps.document",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
  presentation: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  image: "image/",
  folder: "application/vnd.google-apps.folder",
  video: "video/",
}

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const term = searchParams.get("term")
    const type = searchParams.get("type") || undefined
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
    const pageToken = searchParams.get("pageToken") || undefined

    if (!term) {
      return badRequest("Missing required query parameter: term")
    }

    const queryParts: string[] = [
      `fullText contains '${term.replace(/'/g, "\\'")}'`,
      "trashed = false",
    ]

    if (type && TYPE_MIME_MAP[type]) {
      const mime = TYPE_MIME_MAP[type]
      if (mime.endsWith("/")) {
        queryParts.push(`mimeType contains '${mime}'`)
      } else {
        queryParts.push(`mimeType = '${mime}'`)
      }
    }

    const drive = createDriveServiceFromToken(accessToken)
    const res = await drive.files.list({
      q: queryParts.join(" and "),
      pageSize: limit,
      pageToken,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, shared, starred, webViewLink, iconLink, thumbnailLink, owners)",
    })

    return NextResponse.json({
      files: res.data.files || [],
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}
