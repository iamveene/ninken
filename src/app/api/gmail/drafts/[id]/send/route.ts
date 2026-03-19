import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/gmail/drafts/[id]/send">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.drafts.send({
      userId: "me",
      requestBody: { id },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
