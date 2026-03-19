import { NextResponse } from "next/server"
import { createStorageService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, badRequest, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const project = searchParams.get("project")
    if (!project) return badRequest("Missing required query parameter: project")

    const storage = createStorageService(token)
    const res = await storage.buckets.list({ project })
    const buckets = res.data.items || []

    // Check which buckets have objects (request 1 item to keep it fast)
    const objectChecks = await Promise.allSettled(
      buckets.map(async (bucket) => {
        try {
          const objRes = await storage.objects.list({
            bucket: bucket.name!,
            maxResults: 1,
          })
          const hasObjects = (objRes.data.items?.length ?? 0) > 0
          return { ...bucket, hasObjects }
        } catch {
          return { ...bucket, hasObjects: false }
        }
      })
    )

    const enriched = objectChecks.map((result) =>
      result.status === "fulfilled" ? result.value : { hasObjects: false }
    )

    // Sort: buckets with files first, then empty buckets
    enriched.sort((a, b) => {
      if (a.hasObjects && !b.hasObjects) return -1
      if (!a.hasObjects && b.hasObjects) return 1
      return (a.name || "").localeCompare(b.name || "")
    })

    return NextResponse.json({ buckets: enriched })
  } catch (error) {
    return serverError(error)
  }
}
