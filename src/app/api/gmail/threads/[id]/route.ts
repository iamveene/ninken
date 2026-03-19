import { NextResponse } from "next/server"
import { createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gmail/threads/[id]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailService(token)
    const res = await gmail.users.threads.get({
      userId: "me",
      id,
      format: "full",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
