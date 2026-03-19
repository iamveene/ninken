import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

type ChannelsResponse = {
  value?: Array<{
    id: string
    displayName: string
    description: string | null
    membershipType: string
  }>
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/teams/[teamId]/channels">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { teamId } = await ctx.params
    const data = await graphJson<ChannelsResponse>(
      credential,
      `/teams/${teamId}/channels?$select=id,displayName,description,membershipType`
    )

    return NextResponse.json({ channels: data.value || [] })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
