import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
    const pageToken = searchParams.get("pageToken") || undefined

    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.drafts.list({
      userId: "me",
      maxResults: limit,
      pageToken,
    })

    const drafts = res.data.drafts || []
    const detailed = await Promise.all(
      drafts.map(async (draft) => {
        const detail = await gmail.users.drafts.get({
          userId: "me",
          id: draft.id!,
          format: "metadata",
        })
        return detail.data
      })
    )

    return NextResponse.json({
      drafts: detailed,
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const body = await request.json()
    const { to, cc, bcc, subject, body: messageBody } = body

    if (!subject) {
      return badRequest("Missing required field: subject")
    }

    const sanitizeHeader = (val: string): string =>
      val.replace(/[\r\n]/g, "")

    const mimeLines: string[] = [
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
    ]
    if (to) mimeLines.push(`To: ${sanitizeHeader(to)}`)
    if (cc) mimeLines.push(`Cc: ${sanitizeHeader(cc)}`)
    if (bcc) mimeLines.push(`Bcc: ${sanitizeHeader(bcc)}`)
    mimeLines.push(`Subject: ${sanitizeHeader(subject)}`)
    mimeLines.push("")
    mimeLines.push(messageBody || "")

    const raw = Buffer.from(mimeLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: { raw },
      },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
