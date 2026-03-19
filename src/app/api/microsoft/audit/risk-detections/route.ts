import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated, sanitizeODataValue } from "@/lib/microsoft"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const top = Math.min(Number(searchParams.get("top")) || 50, 999)
    const userId = searchParams.get("userId") || undefined
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(credential, "/identityProtection/riskDetections", {
      top,
      select: [
        "id",
        "riskEventType",
        "riskState",
        "riskLevel",
        "riskDetail",
        "detectionTimingType",
        "activity",
        "ipAddress",
        "location",
        "activityDateTime",
        "detectedDateTime",
        "userDisplayName",
        "userPrincipalName",
        "userId",
      ].join(","),
      orderby: "activityDateTime desc",
      filter: userId ? `userId eq '${sanitizeODataValue(userId)}'` : undefined,
      pageToken,
    })

    return NextResponse.json({
      riskDetections: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
