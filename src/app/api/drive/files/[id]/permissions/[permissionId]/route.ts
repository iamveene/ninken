import { NextResponse } from "next/server"
import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../../_helpers"

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/permissions/[permissionId]">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id, permissionId } = await ctx.params
    const drive = createDriveServiceFromToken(accessToken)
    await drive.permissions.delete({
      fileId: id,
      permissionId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error, "google")
  }
}
