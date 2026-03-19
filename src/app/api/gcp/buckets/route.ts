import { NextResponse } from "next/server"
import { createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const project = searchParams.get("project")
    if (!project) return badRequest("Missing required query parameter: project")

    const storage = createStorageServiceFromToken(accessToken)
    const res = await storage.buckets.list({ project })
    const buckets = res.data.items || []

    // Check which buckets have objects, are readable, and are downloadable
    const objectChecks = await Promise.allSettled(
      buckets.map(async (bucket) => {
        try {
          const objRes = await storage.objects.list({
            bucket: bucket.name!,
            maxResults: 1,
          })
          const items = objRes.data.items || []
          const hasObjects = items.length > 0

          // If there are objects, probe download access by trying to get metadata
          let downloadable = true
          if (hasObjects) {
            try {
              await storage.objects.get({ bucket: bucket.name!, object: items[0].name! })
            } catch (dlErr) {
              const dlCode = dlErr && typeof dlErr === "object" && "code" in dlErr ? (dlErr as { code: number }).code : 0
              if (dlCode === 403) downloadable = false
            }
          }

          return { ...bucket, hasObjects, readable: true, downloadable }
        } catch (err) {
          const code = err && typeof err === "object" && "code" in err ? (err as { code: number }).code : 0
          return { ...bucket, hasObjects: false, readable: code !== 403, downloadable: false }
        }
      })
    )

    const enriched = objectChecks.map((result) =>
      result.status === "fulfilled" ? result.value : { hasObjects: false, readable: false, downloadable: false }
    )

    // Sort: downloadable first, then readable-only, then unreadable
    enriched.sort((a, b) => {
      if (a.downloadable && !b.downloadable) return -1
      if (!a.downloadable && b.downloadable) return 1
      if (a.readable && !b.readable) return -1
      if (!a.readable && b.readable) return 1
      if (a.hasObjects && !b.hasObjects) return -1
      if (!a.hasObjects && b.hasObjects) return 1
      return (a.name || "").localeCompare(b.name || "")
    })

    return NextResponse.json({ buckets: enriched })
  } catch (error) {
    return serverError(error, "google")
  }
}
