import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/microsoft/sharepoint/sites/[siteId]/lists/[listId]/items">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { siteId, listId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const top = Math.min(Number(searchParams.get("top")) || 50, 200)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(
      credential,
      `/sites/${siteId}/lists/${listId}/items?$expand=fields`,
      { top, pageToken }
    )

    return NextResponse.json({
      items: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
