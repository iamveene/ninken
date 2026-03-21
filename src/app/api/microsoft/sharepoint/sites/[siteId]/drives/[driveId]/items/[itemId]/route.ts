import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/sharepoint/sites/[siteId]/drives/[driveId]/items/[itemId]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { siteId, driveId, itemId } = await ctx.params
    const data = await graphJson(
      credential,
      `/sites/${siteId}/drives/${driveId}/items/${itemId}?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference`
    )
    return NextResponse.json(data)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
