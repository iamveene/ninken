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

    // Check which buckets have objects and whether we can read them
    const objectChecks = await Promise.allSettled(
      buckets.map(async (bucket) => {
        try {
          const objRes = await storage.objects.list({
            bucket: bucket.name!,
            maxResults: 1,
          })
          const hasObjects = (objRes.data.items?.length ?? 0) > 0
          return { ...bucket, hasObjects, readable: true }
        } catch (err) {
          const code = err && typeof err === "object" && "code" in err ? (err as { code: number }).code : 0
          // 403 = we can see the bucket but can't read its objects
          return { ...bucket, hasObjects: false, readable: code !== 403 }
        }
      })
    )

    const enriched = objectChecks.map((result) =>
      result.status === "fulfilled" ? result.value : { hasObjects: false, readable: false }
    )

    // Sort: readable with objects first, readable empty, then unreadable
    enriched.sort((a, b) => {
      if (a.readable && !b.readable) return -1
      if (!a.readable && b.readable) return 1
      if (a.hasObjects && !b.hasObjects) return -1
      if (!a.hasObjects && b.hasObjects) return 1
      return (a.name || "").localeCompare(b.name || "")
    })

    return NextResponse.json({ buckets: enriched })
  } catch (error) {
    return serverError(error)
  }
}
