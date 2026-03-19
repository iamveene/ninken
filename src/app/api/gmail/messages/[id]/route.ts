import { NextResponse } from "next/server"
import { createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    const res = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { addLabelIds, removeLabelIds } = body

    const gmail = createGmailService(token)
    const res = await gmail.users.messages.modify({
      userId: "me",
      id,
      requestBody: {
        addLabelIds: addLabelIds || [],
        removeLabelIds: removeLabelIds || [],
      },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    await gmail.users.messages.trash({
      userId: "me",
      id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error)
  }
}
