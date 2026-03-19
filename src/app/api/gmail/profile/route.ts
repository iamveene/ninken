import { NextResponse } from "next/server"
import { createGmailService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const gmail = createGmailService(token)
    const res = await gmail.users.getProfile({ userId: "me" })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
