import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const top = Math.min(Number(searchParams.get("top")) || 50, 999)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(credential, "/identityProtection/riskyUsers", {
      top,
      select: [
        "id",
        "userDisplayName",
        "userPrincipalName",
        "riskLevel",
        "riskState",
        "riskDetail",
        "riskLastUpdatedDateTime",
        "isDeleted",
        "isProcessing",
      ].join(","),
      orderby: "riskLastUpdatedDateTime desc",
      pageToken,
    })

    return NextResponse.json({
      riskyUsers: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
