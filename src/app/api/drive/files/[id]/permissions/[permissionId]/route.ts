import { NextResponse } from "next/server"
import { createDriveService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../../../_helpers"

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/permissions/[permissionId]">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id, permissionId } = await ctx.params
    const drive = createDriveService(token)
    await drive.permissions.delete({
      fileId: id,
      permissionId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error)
  }
}
