import { NextResponse } from "next/server"
import { createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../../_helpers"

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]/untrash">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    const res = await gmail.users.messages.untrash({
      userId: "me",
      id,
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
