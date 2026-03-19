import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]/untrash">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.messages.untrash({
      userId: "me",
      id,
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
