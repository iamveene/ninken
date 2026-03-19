import { NextResponse } from "next/server"
import { createDirectoryService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryService(token)
    const res = await admin.groups.list({
      customer: "my_customer",
      maxResults: 200,
      pageToken,
    })

    const groups = (res.data.groups || []).map((g) => ({
      id: g.id || "",
      name: g.name || "",
      email: g.email || "",
      directMembersCount: g.directMembersCount || "0",
      description: g.description || "",
    }))

    return NextResponse.json({
      groups,
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}
