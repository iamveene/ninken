import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/microsoft/directory/groups/[id]/members">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(
      credential,
      `/groups/${id}/members`,
      {
        select: "id,displayName,mail,userPrincipalName",
        pageToken,
      }
    )

    return NextResponse.json({
      members: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
