import { NextResponse } from "next/server"
import { createDirectoryService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || undefined
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryService(token)
    const res = await admin.users.list({
      customer: "my_customer",
      projection: "full",
      maxResults: 500,
      query,
      pageToken,
      orderBy: query ? undefined : "email",
    })

    const users = (res.data.users || []).map((u) => ({
      primaryEmail: u.primaryEmail || "",
      fullName: u.name?.fullName || "",
      isAdmin: u.isAdmin || false,
      isDelegatedAdmin: u.isDelegatedAdmin || false,
      isEnrolledIn2Sv: u.isEnrolledIn2Sv || false,
      isEnforcedIn2Sv: u.isEnforcedIn2Sv || false,
      suspended: u.suspended || false,
      lastLoginTime: u.lastLoginTime || null,
      orgUnitPath: u.orgUnitPath || "/",
      creationTime: u.creationTime || "",
    }))

    return NextResponse.json({
      users,
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}
