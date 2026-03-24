import { NextResponse } from "next/server"
import { createGmailServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gmail/messages/[id]/raw
 *
 * Returns the raw RFC822 email message as a downloadable .eml file.
 * Used by the Collection system to download email artifacts.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/gmail/messages/[id]/raw">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const gmail = createGmailServiceFromToken(accessToken)

    // Fetch message in RAW format — returns base64url-encoded RFC822
    const res = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "raw",
    })

    const raw = res.data.raw
    if (!raw) {
      return NextResponse.json({ error: "No raw content available" }, { status: 404 })
    }

    // Decode base64url to binary
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/")
    const binary = Buffer.from(base64, "base64")

    // Get subject for filename
    const subject = res.data.snippet?.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, "") || "message"
    const emlFilename = `${subject}.eml`

    // RFC 6266: dual Content-Disposition for non-ASCII filename support (HI-6)
    const asciiName = emlFilename.replace(/[^\x20-\x7e]/g, "_")
    const encodedName = encodeURIComponent(emlFilename)

    return new NextResponse(binary, {
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(binary.length),
      },
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
