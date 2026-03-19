import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/mail/messages/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const message = await graphJson(credential, `/me/messages/${id}`)
    return NextResponse.json(message)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/microsoft/mail/messages/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const body = await request.json()

    // Allow updating isRead and flag status
    const update: Record<string, unknown> = {}
    if (typeof body.isRead === "boolean") {
      update.isRead = body.isRead
    }
    if (body.flag?.flagStatus) {
      update.flag = { flagStatus: body.flag.flagStatus }
    }

    const result = await graphJson(credential, `/me/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    })

    return NextResponse.json(result)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/mail/messages/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params

    // Soft delete: move to Deleted Items instead of permanent delete
    const result = await graphJson(credential, `/me/messages/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: "deleteditems" }),
    })

    return NextResponse.json(result)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
