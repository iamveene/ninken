import { NextResponse } from "next/server"
import { createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"
import JSZip from "jszip"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp/buckets/[name]/download
 * Downloads all objects in a bucket (or prefix) as a ZIP.
 * ?prefix=assets/ to download only a sub-folder.
 * Max 500 objects to prevent abuse.
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
  const MAX_OBJECTS = 500

  try {
    const storage = createStorageServiceFromToken(accessToken)

    // List all objects under the prefix
    let allObjects: { name: string; size?: string }[] = []
    let pageToken: string | undefined
    do {
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

    // Download each object and add to ZIP
    const zip = new JSZip()
    const downloadResults = await Promise.allSettled(
      allObjects.map(async (obj) => {
        try {
          const res = await storage.objects.get(
            { bucket, object: obj.name, alt: "media" },
            { responseType: "arraybuffer" }
          )
          const data = res.data as ArrayBuffer
          // Use path relative to prefix for folder structure
          const relativePath = prefix ? obj.name.replace(prefix, "") : obj.name
          if (relativePath) {
            zip.file(relativePath, new Uint8Array(data))
          }
        } catch {
          // Skip objects we can't download
        }
      })
    )

    const added = downloadResults.filter((r) => r.status === "fulfilled").length
    if (added === 0) {
      return NextResponse.json({ error: "No downloadable objects" }, { status: 403 })
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
