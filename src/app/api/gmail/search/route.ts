import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
    const pageToken = searchParams.get("pageToken") || undefined

    if (!q) {
      return badRequest("Missing required query parameter: q")
    }

    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: limit,
      pageToken,
    })

    const messages = res.data.messages || []
    const detailed = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        })
        return detail.data
      })
    )

    return NextResponse.json({
      messages: detailed,
      nextPageToken: res.data.nextPageToken || null,
      resultSizeEstimate: res.data.resultSizeEstimate || 0,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
