import { NextResponse } from "next/server"
import { Readable } from "stream"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || undefined
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
    const folder = searchParams.get("folder") || searchParams.get("folderId") || undefined
    const ALLOWED_ORDER_FIELDS = ["name", "modifiedTime", "createdTime", "folder", "quotaBytesUsed"]
    const rawOrderBy = searchParams.get("orderBy") || "modifiedTime desc"
    const orderBy = ALLOWED_ORDER_FIELDS.some((f) => rawOrderBy.startsWith(f)) ? rawOrderBy : "modifiedTime desc"
    const pageToken = searchParams.get("pageToken") || undefined

    let query = "trashed = false"
    if (folder) {
      // Sanitize folder ID to prevent query injection
      const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "")
      if (!sanitizedFolder) return badRequest("Invalid folder ID")
      query += ` and '${sanitizedFolder}' in parents`
    }
    if (q) {
      // Only allow safe query operators from our own frontend
      const safeQ = q.replace(/'/g, "\\'")
      query += ` and ${safeQ}`
    }

    const driveId = searchParams.get("driveId") || undefined

    const drive = createDriveServiceFromToken(accessToken)
    const res = await drive.files.list({
      q: query,
      pageSize: limit,
      pageToken,
      orderBy,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, shared, starred, webViewLink, iconLink, thumbnailLink, owners)",
      ...(driveId
        ? {
            corpora: "drive",
            driveId,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
          }
        : {
            supportsAllDrives: true,
          }),
    })

    return NextResponse.json({
      files: res.data.files || [],
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return badRequest("Expected multipart/form-data")
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const name = (formData.get("name") as string) || file?.name
    const parent = formData.get("parent") as string | null

    if (!file) {
      return badRequest("Missing required field: file")
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return badRequest("File size exceeds maximum allowed size of 100MB")
    }

    const drive = createDriveServiceFromToken(accessToken)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const res = await drive.files.create({
      requestBody: {
        name: name || file.name,
        parents: parent ? [parent] : undefined,
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id, name, mimeType, size, modifiedTime, webViewLink",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
