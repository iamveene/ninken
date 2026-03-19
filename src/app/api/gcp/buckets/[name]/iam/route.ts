import { NextResponse } from "next/server"
import { createStorageService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/iam">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { name } = await ctx.params
    const storage = createStorageService(token)
    const res = await storage.buckets.getIamPolicy({ bucket: name })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
