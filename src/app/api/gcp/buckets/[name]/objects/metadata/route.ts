import { NextResponse } from "next/server"
import { createStorageService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, badRequest, serverError } from "../../../../../_helpers"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/objects/metadata">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { name } = await ctx.params
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")
    if (!path) return badRequest("Missing required query parameter: path")

    const storage = createStorageService(token)
    const res = await storage.objects.get({ bucket: name, object: path })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
