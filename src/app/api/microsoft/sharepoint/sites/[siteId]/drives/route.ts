import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/microsoft/sharepoint/sites/[siteId]/drives">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { siteId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(credential, `/sites/${siteId}/drives`, {
      select: "id,name,description,webUrl,driveType,createdDateTime,quota",
      pageToken,
    })

    return NextResponse.json({
      drives: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
