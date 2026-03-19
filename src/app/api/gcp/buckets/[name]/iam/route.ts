import { NextResponse } from "next/server"
import { createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/iam">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { name } = await ctx.params
    const storage = createStorageServiceFromToken(accessToken)
    const res = await storage.buckets.getIamPolicy({ bucket: name })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
