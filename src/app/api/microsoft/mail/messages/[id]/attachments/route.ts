import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

type AttachmentListResponse = {
  value: {
    id: string
    name: string
    contentType: string
    size: number
    isInline: boolean
  }[]
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/mail/messages/[id]/attachments">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const result = await graphJson<AttachmentListResponse>(
      credential,
      `/me/messages/${id}/attachments`
    )

    return NextResponse.json({ attachments: result.value || [] })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
