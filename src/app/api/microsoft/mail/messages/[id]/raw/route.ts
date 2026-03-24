import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphFetch } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

/**
 * GET /api/microsoft/mail/messages/[id]/raw
 * Downloads the message in MIME format (RFC822 .eml).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  const { id } = await params

  try {
    const res = await graphFetch(credential, `/me/messages/${id}/$value`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Graph MIME fetch: ${res.status} ${text}`)
    }

    const data = await res.arrayBuffer()

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="message_${id}.eml"`,
        "Content-Length": String(data.byteLength),
      },
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
