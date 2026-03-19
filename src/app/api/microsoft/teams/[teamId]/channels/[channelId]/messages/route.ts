import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/microsoft/teams/[teamId]/channels/[channelId]/messages">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { teamId, channelId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(
      credential,
      `/teams/${teamId}/channels/${channelId}/messages`,
      {
        top: 50,
        pageToken,
      }
    )

    return NextResponse.json({
      messages: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
