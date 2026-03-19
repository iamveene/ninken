import { NextResponse } from "next/server"
import { createReportsServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/audit/admin-reports
 *
 * Lists audit activities from the Google Admin Reports API.
 * Supports application types: login, admin, token, drive, mobile.
 * Gracefully degrades on 403 (returns empty activities with scope: "denied").
 */
export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const application = searchParams.get("application") || "login"
    const userKey = searchParams.get("userKey") || "all"
    const pageToken = searchParams.get("pageToken") || undefined
    const startTime = searchParams.get("startTime") || undefined
    const endTime = searchParams.get("endTime") || undefined

    const validApplications = ["login", "admin", "token", "drive", "mobile"]
    if (!validApplications.includes(application)) {
      return NextResponse.json(
        { error: `Invalid application: ${application}. Must be one of: ${validApplications.join(", ")}` },
        { status: 400 }
      )
    }

    const reports = createReportsServiceFromToken(accessToken)

    try {
      const res = await reports.activities.list({
        userKey,
        applicationName: application,
        customerId: "my_customer",
        maxResults: 200,
        startTime,
        endTime,
        pageToken,
      })

      const activities = (res.data.items || []).map((item) => ({
        id: item.id?.uniqueQualifier || "",
        time: item.id?.time || "",
        actor: item.actor?.email || item.actor?.profileId || "Unknown",
        ipAddress: item.ipAddress || "",
        eventType: item.events?.[0]?.type || "",
        eventName: item.events?.[0]?.name || "",
        applicationName: application,
        parameters: (item.events?.[0]?.parameters || []).map((p) => ({
          name: p.name || "",
          value: p.value || p.intValue || p.boolValue?.toString() || p.multiValue?.join(", ") || "",
        })),
        regionCode: "",
      }))

      return NextResponse.json({
        activities,
        nextPageToken: res.data.nextPageToken || null,
        scope: "full",
      })
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : 0
      if (code === 403) {
        return NextResponse.json({
          activities: [],
          nextPageToken: null,
          scope: "denied",
        })
      }
      throw err
    }
  } catch (error) {
    return serverError(error, "google")
  }
}
