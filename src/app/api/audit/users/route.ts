import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken, createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/audit/users
 *
 * Tries admin.users.list first (full org view).
 * Falls back to current user's own profile if admin access denied.
 */
export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || undefined
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryServiceFromToken(accessToken)

    // Try full admin listing first
    try {
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
        scope: "organization",
      })
    } catch (adminErr) {
      const code = adminErr && typeof adminErr === "object" && "code" in adminErr
        ? (adminErr as { code: number }).code : 0
      if (code !== 403) throw adminErr

      // Fallback: get current user's own profile
      const gmail = createGmailServiceFromToken(accessToken)
      const profile = await gmail.users.getProfile({ userId: "me" })
      const email = profile.data.emailAddress || ""

      // Try to get the user's own directory entry
      let selfUser = {
        primaryEmail: email,
        fullName: email.split("@")[0],
        isAdmin: false,
        isDelegatedAdmin: false,
        isEnrolledIn2Sv: false,
        isEnforcedIn2Sv: false,
        suspended: false,
        lastLoginTime: null as string | null,
        orgUnitPath: "/",
        creationTime: "",
      }

      try {
        const userRes = await admin.users.get({ userKey: email, projection: "full" })
        const u = userRes.data
        selfUser = {
          primaryEmail: u.primaryEmail || email,
          fullName: u.name?.fullName || email.split("@")[0],
          isAdmin: u.isAdmin || false,
          isDelegatedAdmin: u.isDelegatedAdmin || false,
          isEnrolledIn2Sv: u.isEnrolledIn2Sv || false,
          isEnforcedIn2Sv: u.isEnforcedIn2Sv || false,
          suspended: u.suspended || false,
          lastLoginTime: u.lastLoginTime || null,
          orgUnitPath: u.orgUnitPath || "/",
          creationTime: u.creationTime || "",
        }
      } catch {
        // Can't even get own directory entry — use Gmail profile only
      }

      return NextResponse.json({
        users: [selfUser],
        nextPageToken: null,
        scope: "self",
      })
    }
  } catch (error) {
    return serverError(error, "google")
  }
}
