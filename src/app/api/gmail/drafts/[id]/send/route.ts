import { NextResponse } from "next/server"
import { createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../../_helpers"

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/gmail/drafts/[id]/send">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    const res = await gmail.users.drafts.send({
      userId: "me",
      requestBody: { id },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
