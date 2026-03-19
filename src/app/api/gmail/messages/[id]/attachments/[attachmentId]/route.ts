import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]/attachments/[attachmentId]">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id, attachmentId } = await ctx.params
    const gmail = createGmailServiceFromToken(accessToken)

    // First get the message to find attachment metadata
    const message = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    })

    const parts = message.data.payload?.parts || []
    const attachmentPart = parts.find(
      (p) => p.body?.attachmentId === attachmentId
    )

    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: id,
      id: attachmentId,
    })

    const data = res.data.data
    if (!data) {
      return new Response("Attachment data not found", { status: 404 })
    }

    // Convert from URL-safe base64 to standard base64
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
    const buffer = Buffer.from(base64, "base64")

    const rawFilename = attachmentPart?.filename || "attachment"
    // Sanitize filename: remove path separators, quotes, and control chars
    const filename = rawFilename
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 255)
    const mimeType = attachmentPart?.mimeType || "application/octet-stream"

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
