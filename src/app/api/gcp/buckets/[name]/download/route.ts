import { NextResponse } from "next/server"
import { createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"
import JSZip from "jszip"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp/buckets/[name]/download
 * Downloads all objects in a bucket (or prefix) as a ZIP.
 * ?prefix=assets/ to download only a sub-folder.
 * Limits: 10k objects listed, 50MB/object, 500MB total, 4-min timeout.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  const { name: bucket } = await params
  const { searchParams } = new URL(request.url)
  const prefix = searchParams.get("prefix") || ""
  const MAX_OBJECTS = 10_000                   // listing is metadata-only, cheap
  const MAX_OBJECT_SIZE = 50 * 1024 * 1024     // 50 MB per object
  const MAX_TOTAL_SIZE = 500 * 1024 * 1024     // 500 MB total download
  const OPERATION_TIMEOUT_MS = 4 * 60 * 1000   // 4 minutes for actual downloads

  try {
    const storage = createStorageServiceFromToken(accessToken)
    const deadline = Date.now() + OPERATION_TIMEOUT_MS

    // List all objects under the prefix
    let allObjects: { name: string; size?: string }[] = []
    let pageToken: string | undefined
    do {
      if (Date.now() > deadline) {
        return NextResponse.json({ error: "Operation timed out listing objects" }, { status: 504 })
      }
      const res = await storage.objects.list({
        bucket,
        prefix: prefix || undefined,
        maxResults: 1000,
        pageToken,
      })
      const items = res.data.items ?? []
      allObjects.push(...items.map((o) => ({ name: o.name!, size: o.size ?? undefined })))
      pageToken = res.data.nextPageToken ?? undefined
      if (allObjects.length > MAX_OBJECTS) {
        allObjects = allObjects.slice(0, MAX_OBJECTS)
        break
      }
    } while (pageToken)

    if (allObjects.length === 0) {
      return NextResponse.json({ error: "No objects found in bucket" }, { status: 404 })
    }

    // Filter out objects that are too large
    const downloadable = allObjects.filter((obj) => {
      if (obj.name.endsWith("/")) return false
      const size = obj.size ? parseInt(obj.size, 10) : 0
      return size <= MAX_OBJECT_SIZE
    })

    if (downloadable.length === 0) {
      return NextResponse.json({ error: "No downloadable objects (all exceed 50MB limit)" }, { status: 403 })
    }

    // Download each object and add to ZIP
    const zip = new JSZip()
    let added = 0
    let totalSize = 0
    let timedOut = false

    // Process in batches of 20
    for (let i = 0; i < downloadable.length; i += 20) {
      if (Date.now() > deadline) { timedOut = true; break }
      if (totalSize >= MAX_TOTAL_SIZE) break

      const batch = downloadable.slice(i, i + 20)
      const results = await Promise.allSettled(
        batch.map(async (obj) => {
          const res = await storage.objects.get(
            { bucket, object: obj.name, alt: "media" },
            { responseType: "arraybuffer" }
          )
          const data = res.data as ArrayBuffer
          if (data.byteLength > MAX_OBJECT_SIZE) return false
          const relativePath = prefix ? obj.name.replace(prefix, "") : obj.name
          if (relativePath && data.byteLength > 0) {
            zip.file(relativePath, new Uint8Array(data))
            return data.byteLength
          }
          return false
        })
      )
      for (const r of results) {
        if (r.status === "fulfilled" && typeof r.value === "number") {
          added++
          totalSize += r.value
        }
      }
    }

    if (added === 0) {
      return NextResponse.json(
        { error: timedOut ? "Operation timed out before downloading any objects" : "No downloadable objects" },
        { status: timedOut ? 504 : 403 }
      )
    }

    const zipData = await zip.generateAsync({ type: "uint8array" })
    const safeName = bucket.replace(/[^a-zA-Z0-9._-]/g, "_")

    return new Response(zipData as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}.zip"`,
        "Content-Length": String(zipData.byteLength),
      },
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
