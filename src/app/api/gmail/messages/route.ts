import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, badRequest, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || undefined
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
    const pageToken = searchParams.get("pageToken") || undefined

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

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const body = await request.json()
    const { to, cc, bcc, subject, body: messageBody, attachments } = body

    if (!to || !subject) {
      return badRequest("Missing required fields: to, subject")
    }

    // Sanitize header values to prevent MIME header injection
    const sanitizeHeader = (val: string): string =>
      val.replace(/[\r\n]/g, "")

    const boundary = `boundary_${Date.now()}`
    const mimeLines: string[] = []

    const hasAttachments = attachments && attachments.length > 0

    if (hasAttachments) {
      mimeLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    } else {
      mimeLines.push("Content-Type: text/html; charset=utf-8")
    }
    mimeLines.push("MIME-Version: 1.0")
    mimeLines.push(`To: ${sanitizeHeader(to)}`)
    if (cc) mimeLines.push(`Cc: ${sanitizeHeader(cc)}`)
    if (bcc) mimeLines.push(`Bcc: ${sanitizeHeader(bcc)}`)
    mimeLines.push(`Subject: ${sanitizeHeader(subject)}`)
    mimeLines.push("")

    if (hasAttachments) {
      mimeLines.push(`--${boundary}`)
      mimeLines.push("Content-Type: text/html; charset=utf-8")
      mimeLines.push("")
      mimeLines.push(messageBody || "")
      mimeLines.push("")

      for (const att of attachments) {
        mimeLines.push(`--${boundary}`)
        mimeLines.push(`Content-Type: ${att.mimeType || "application/octet-stream"}`)
        mimeLines.push("Content-Transfer-Encoding: base64")
        mimeLines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
        mimeLines.push("")
        mimeLines.push(att.data)
        mimeLines.push("")
      }
      mimeLines.push(`--${boundary}--`)
    } else {
      mimeLines.push(messageBody || "")
    }

    const raw = Buffer.from(mimeLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    const gmail = createGmailServiceFromToken(accessToken)
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
