import { NextResponse } from "next/server"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/drive/files/[id]">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const drive = createDriveServiceFromToken(accessToken)
    const res = await drive.files.get({
      fileId: id,
      fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, shared, starred, webViewLink, iconLink, thumbnailLink, owners, description, permissions",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/drive/files/[id]">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { name, addParents, removeParents, trashed, starred, description } = body

    const drive = createDriveServiceFromToken(accessToken)
    const res = await drive.files.update({
      fileId: id,
      addParents: addParents || undefined,
      removeParents: removeParents || undefined,
      requestBody: {
        name: name || undefined,
        trashed: trashed !== undefined ? trashed : undefined,
        starred: starred !== undefined ? starred : undefined,
        description: description !== undefined ? description : undefined,
      },
      fields: "id, name, mimeType, size, modifiedTime, parents, shared, starred, trashed, webViewLink",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/drive/files/[id]">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const drive = createDriveServiceFromToken(accessToken)
    await drive.files.delete({ fileId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error)
  }
}
