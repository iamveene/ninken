import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || undefined
    const domain = searchParams.get("domain") || undefined
    const maxResults = Math.min(Math.max(1, Number(searchParams.get("maxResults")) || 50), 500)
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryServiceFromToken(accessToken)
    const res = await admin.users.list({
      customer: domain ? undefined : "my_customer",
      domain,
      query,
      maxResults,
      pageToken,
      projection: "basic",
      orderBy: query ? undefined : "email",
    })

    return NextResponse.json({
      users: res.data.users || [],
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
