import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.getProfile({ userId: "me" })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
