import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.labels.list({ userId: "me" })

    const labels = res.data.labels || []

    // Fetch detailed info (unread counts) for each label
    const detailed = await Promise.all(
      labels.map(async (label) => {
        const detail = await gmail.users.labels.get({
          userId: "me",
          id: label.id!,
        })
        return detail.data
      })
    )

    return NextResponse.json({ labels: detailed })
  } catch (error) {
    return serverError(error, "google")
  }
}
