import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphJson } from "@/lib/microsoft"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/drive/files/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const data = await graphJson(
      credential,
      `/me/drive/items/${id}?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference`
    )
    return NextResponse.json(data)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/microsoft/drive/files/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    const body = await request.json()

    // Support rename and move operations
    const update: Record<string, unknown> = {}
    if (body.name) update.name = body.name
    if (body.parentReference) update.parentReference = body.parentReference

    const data = await graphJson(credential, `/me/drive/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    })

    return NextResponse.json(data)
  } catch (error) {
    return serverError(error, "microsoft")
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/microsoft/drive/files/[id]">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { id } = await ctx.params
    await graphJson(credential, `/me/drive/items/${id}`, {
      method: "DELETE",
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
