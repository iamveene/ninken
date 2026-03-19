import { NextResponse, type NextRequest } from "next/server"
import { createAlertCenterServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/audit/alert-center?filter=&pageSize=50&pageToken=
 *
 * Lists security alerts from Google Alert Center.
 * Falls back gracefully on 403 (scope denied).
 */
export async function GET(request: NextRequest) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  const { searchParams } = request.nextUrl
  const filter = searchParams.get("filter") || undefined
  const pageSize = Math.min(
    Number(searchParams.get("pageSize")) || 50,
    100
  )
  const pageToken = searchParams.get("pageToken") || undefined

  try {
    const alertcenter = createAlertCenterServiceFromToken(accessToken)

    const res = await alertcenter.alerts.list({
      filter,
      orderBy: "create_time desc",
      pageSize,
      pageToken,
    })

    const alerts = (res.data.alerts || []).map((a) => ({
      alertId: a.alertId || "",
      type: a.type || "Unknown",
      source: a.source || "Unknown",
      createTime: a.createTime || "",
      severity: classifySeverity(a.type || ""),
      deleted: a.deleted || false,
      data: a.data || {},
    }))

    return NextResponse.json({
      alerts,
      nextPageToken: res.data.nextPageToken || null,
      scope: "granted",
    })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code: number }).code
        : 0

    if (code === 403) {
      return NextResponse.json({
        alerts: [],
        nextPageToken: null,
        scope: "denied",
      })
    }

    return serverError(error)
  }
}

function classifySeverity(
  alertType: string
): "critical" | "high" | "medium" | "low" {
  const lower = alertType.toLowerCase()

  // Critical: government-backed attacks, leaked passwords, state-sponsored
  if (
    lower.includes("government") ||
    lower.includes("state_sponsored") ||
    lower.includes("state-sponsored") ||
    lower.includes("leaked_password") ||
    lower.includes("leaked password")
  ) {
    return "critical"
  }

  // High: suspicious activity, user suspended
  if (
    lower.includes("suspicious_login") ||
    lower.includes("suspicious login") ||
    lower.includes("suspicious_programmatic") ||
    lower.includes("user_suspended") ||
    lower.includes("user suspended")
  ) {
    return "high"
  }

  // Medium: phishing, data export
  if (
    lower.includes("phishing") ||
    lower.includes("data_export") ||
    lower.includes("data export")
  ) {
    return "medium"
  }

  // Low: everything else (device compromised, outages, etc.)
  return "low"
}
