import { NextResponse } from "next/server"
import { Readable } from "stream"
import { createStorageService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, badRequest, serverError } from "../../../../_helpers"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/objects">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { name } = await ctx.params
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get("prefix") || undefined
    const delimiter = searchParams.get("delimiter") || "/"
    const pageToken = searchParams.get("pageToken") || undefined
    const maxResults = Math.min(Number(searchParams.get("maxResults")) || 50, 200)

    const storage = createStorageService(token)
    const res = await storage.objects.list({
      bucket: name,
      prefix,
      delimiter,
      pageToken,
      maxResults,
    })

    const objects = res.data.items || []

    // Quick download permission check: try to get metadata of first object
    let canDownload = true
    if (objects.length > 0) {
      try {
        await storage.objects.get({ bucket: name, object: objects[0].name! })
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code: number }).code : 0
        if (code === 403) canDownload = false
      }
    }

    return NextResponse.json({
      objects,
      prefixes: res.data.prefixes || [],
      nextPageToken: res.data.nextPageToken,
      canDownload,
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/objects">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { name } = await ctx.params
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return badRequest("Expected multipart/form-data")
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const prefix = formData.get("prefix") as string | null

    if (!file) {
      return badRequest("Missing required field: file")
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return badRequest("File size exceeds maximum allowed size of 100MB")
    }

    const objectName = prefix ? prefix + file.name : file.name
    const mimeType = file.type || "application/octet-stream"

    const storage = createStorageService(token)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const res = await storage.objects.insert({
      bucket: name,
      name: objectName,
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
