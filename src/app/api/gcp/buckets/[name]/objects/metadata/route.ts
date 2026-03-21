import { NextResponse } from "next/server"
import { createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../../../../_helpers"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/objects/metadata">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { name } = await ctx.params
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")
    if (!path) return badRequest("Missing required query parameter: path")

    const storage = createStorageServiceFromToken(accessToken)
    const res = await storage.objects.get({ bucket: name, object: path })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
