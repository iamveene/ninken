import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryServiceFromToken(accessToken)
    const res = await admin.members.list({
      groupKey: id,
      pageToken,
      maxResults: 200,
    })

    return NextResponse.json({
      members: res.data.members || [],
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
