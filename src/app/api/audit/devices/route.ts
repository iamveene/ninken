import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/audit/devices
 *
 * Lists Chrome OS devices and mobile devices from the directory.
 * Falls back gracefully if admin access is denied.
 */
export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined
    const type = searchParams.get("type") || "all" // "chromeos", "mobile", or "all"

    const admin = createDirectoryServiceFromToken(accessToken)

    const chromeDevices: Array<Record<string, unknown>> = []
    const mobileDevices: Array<Record<string, unknown>> = []
    let scope: "organization" | "limited" = "organization"

    // Fetch Chrome OS devices
    if (type === "all" || type === "chromeos") {
      try {
        const res = await admin.chromeosdevices.list({
          customerId: "my_customer",
          maxResults: 200,
          pageToken: type === "chromeos" ? pageToken : undefined,
          projection: "BASIC",
        })

        for (const d of res.data.chromeosdevices || []) {
          chromeDevices.push({
            deviceId: d.deviceId || "",
            serialNumber: d.serialNumber || "",
            model: d.model || "",
            status: d.status || "",
            osVersion: d.osVersion || "",
            platformVersion: d.platformVersion || "",
            lastSync: d.lastSync || null,
            annotatedUser: d.annotatedUser || "",
            annotatedLocation: d.annotatedLocation || "",
            annotatedAssetId: d.annotatedAssetId || "",
            orgUnitPath: d.orgUnitPath || "/",
            macAddress: d.macAddress || "",
            deviceType: "chromeos",
          })
        }
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code : 0
        if (code === 403) {
          scope = "limited"
        } else {
          throw err
        }
      }
    }

    // Fetch mobile devices
    if (type === "all" || type === "mobile") {
      try {
        const res = await admin.mobiledevices.list({
          customerId: "my_customer",
          maxResults: 200,
          pageToken: type === "mobile" ? pageToken : undefined,
        })

        for (const d of res.data.mobiledevices || []) {
          mobileDevices.push({
            deviceId: d.deviceId || "",
            serialNumber: d.serialNumber || "",
            model: d.model || "",
            status: d.status || "",
            os: d.os || "",
            type: d.type || "",
            lastSync: d.lastSync || null,
            email: (d.email || []).join(", "),
            name: (d.name || []).join(", "),
            deviceType: "mobile",
          })
        }
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code : 0
        if (code === 403) {
          scope = "limited"
        } else {
          throw err
        }
      }
    }

    return NextResponse.json({
      chromeDevices,
      mobileDevices,
      scope,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
