import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphFetch } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/sharepoint/sites/[siteId]/drives/[driveId]/items/[itemId]/download">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { siteId, driveId, itemId } = await ctx.params

    // Graph API returns a 302 redirect to the actual download URL
    const res = await graphFetch(
      credential,
      `/sites/${siteId}/drives/${driveId}/items/${itemId}/content`,
      { redirect: "manual" }
    )

    // The Location header contains the pre-authenticated download URL
    const downloadUrl = res.headers.get("Location")
    if (!downloadUrl) {
      return NextResponse.json(
        { error: "No download URL returned" },
        { status: 502 }
      )
    }

    return NextResponse.json({ downloadUrl })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
