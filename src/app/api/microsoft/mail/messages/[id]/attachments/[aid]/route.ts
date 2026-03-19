import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

type FileAttachment = {
  id: string
  name: string
  contentType: string
  contentBytes: string
  size: number
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/mail/messages/[id]/attachments/[aid]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id, aid } = await ctx.params
    const attachment = await graphJson<FileAttachment>(
      credential,
      `/me/messages/${id}/attachments/${aid}`
    )

    if (!attachment.contentBytes) {
      return new Response("Attachment data not found", { status: 404 })
    }

    const buffer = Buffer.from(attachment.contentBytes, "base64")

    // Sanitize filename: remove path separators, quotes, and control chars
    const rawFilename = attachment.name || "attachment"
    const filename = rawFilename
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 255)

    const mimeType = attachment.contentType || "application/octet-stream"

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
