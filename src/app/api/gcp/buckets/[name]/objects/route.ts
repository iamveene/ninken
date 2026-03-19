import { NextResponse } from "next/server"
import { Readable } from "stream"
import { createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../../../_helpers"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/objects">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { name } = await ctx.params
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get("prefix") || undefined
    const delimiter = searchParams.get("delimiter") || "/"
    const pageToken = searchParams.get("pageToken") || undefined
    const maxResults = Math.min(Number(searchParams.get("maxResults")) || 50, 200)

    const storage = createStorageServiceFromToken(accessToken)
    const res = await storage.objects.list({
      bucket: name,
      prefix,
      delimiter,
      pageToken,
      maxResults,
    })

    const objects = res.data.items || []

    // Quick download permission check: try to get metadata of first object
    // When no objects at this level but prefixes exist, probe an object from a sub-prefix
    let canDownload = true
    let probeObject: string | null = null
    if (objects.length > 0) {
      probeObject = objects[0].name!
    } else if ((res.data.prefixes || []).length > 0) {
      // No objects here, try to find one in the first sub-prefix
      try {
        const subRes = await storage.objects.list({
          bucket: name,
          prefix: res.data.prefixes![0],
          maxResults: 1,
        })
        if (subRes.data.items?.length) {
          probeObject = subRes.data.items[0].name!
        }
      } catch {
        // If we can't even list sub-prefix, assume not downloadable
        canDownload = false
      }
    }
    if (probeObject) {
      try {
        await storage.objects.get({ bucket: name, object: probeObject })
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
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

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

    const storage = createStorageServiceFromToken(accessToken)
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
