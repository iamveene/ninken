import { NextResponse } from "next/server"
import { createDirectoryService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || undefined
    const domain = searchParams.get("domain") || undefined
    const maxResults = Math.min(Math.max(1, Number(searchParams.get("maxResults")) || 50), 500)
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryService(token)
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
    return serverError(error)
  }
}
