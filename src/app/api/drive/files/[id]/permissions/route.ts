import { NextResponse } from "next/server"
import { createDriveService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, badRequest, serverError } from "../../../../_helpers"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/permissions">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const drive = createDriveService(token)
    const res = await drive.permissions.list({
      fileId: id,
      fields: "permissions(id, type, role, emailAddress, displayName, domain)",
    })

    return NextResponse.json({
      permissions: res.data.permissions || [],
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/permissions">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { type, role, email, domain } = body

    if (!type || !role) {
      return badRequest("Missing required fields: type, role")
    }

    const VALID_TYPES = ["user", "group", "domain", "anyone"]
    const VALID_ROLES = ["reader", "commenter", "writer", "organizer", "fileOrganizer"]
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`)
    }
    if (!VALID_ROLES.includes(role)) {
      return badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`)
    }
    if ((type === "user" || type === "group") && !email) {
      return badRequest("Email is required for user/group permissions")
    }

    const drive = createDriveService(token)
    const res = await drive.permissions.create({
      fileId: id,
      requestBody: {
        type,
        role,
        emailAddress: email || undefined,
        domain: domain || undefined,
      },
      fields: "id, type, role, emailAddress, displayName, domain",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
