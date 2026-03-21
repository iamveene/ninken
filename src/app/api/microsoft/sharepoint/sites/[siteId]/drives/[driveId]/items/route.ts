import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/microsoft/sharepoint/sites/[siteId]/drives/[driveId]/items">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { siteId, driveId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get("folder") || null
    const top = Math.min(Number(searchParams.get("top")) || 50, 200)
    const orderby = searchParams.get("orderby") || "lastModifiedDateTime desc"
    const pageToken = searchParams.get("pageToken") || undefined

    const path = folder
      ? `/sites/${siteId}/drives/${driveId}/items/${folder}/children`
      : `/sites/${siteId}/drives/${driveId}/root/children`

    const result = await graphPaginated(credential, path, {
      top,
      select: "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference",
      orderby,
      pageToken,
    })

    return NextResponse.json({
      items: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
