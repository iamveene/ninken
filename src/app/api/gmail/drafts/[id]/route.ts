import { NextResponse } from "next/server"
import { createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gmail/drafts/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    const res = await gmail.users.drafts.get({
      userId: "me",
      id,
      format: "full",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/gmail/drafts/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    await gmail.users.drafts.delete({
      userId: "me",
      id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error)
  }
}
