import { NextResponse } from "next/server"
import { createDirectoryService, createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/audit/groups
 *
 * Tries admin.groups.list first (full org view).
 * Falls back to listing groups the current user belongs to.
 */
export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const admin = createDirectoryService(token)

    // Try full admin listing first
    try {
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
        scope: "organization",
      })
    } catch (adminErr) {
      const code = adminErr && typeof adminErr === "object" && "code" in adminErr
        ? (adminErr as { code: number }).code : 0
      if (code !== 403) throw adminErr

      // Fallback: get groups the current user belongs to
      const gmail = createGmailService(token)
      const profile = await gmail.users.getProfile({ userId: "me" })
      const email = profile.data.emailAddress || ""

      try {
        const res = await admin.groups.list({
          userKey: email,
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
          scope: "user",
        })
      } catch {
        // Can't list own groups either
        return NextResponse.json({
          groups: [],
          nextPageToken: null,
          scope: "none",
        })
      }
    }
  } catch (error) {
    return serverError(error)
  }
}
