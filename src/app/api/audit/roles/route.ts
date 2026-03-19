import { NextResponse } from "next/server"
import { createDirectoryService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const admin = createDirectoryService(token)

    const [rolesRes, assignmentsRes] = await Promise.all([
      admin.roles.list({ customer: "my_customer" }),
      admin.roleAssignments.list({ customer: "my_customer" }),
    ])

    const roleAssignments = assignmentsRes.data.items || []

    const roles = (rolesRes.data.items || []).map((r) => {
      const assignees = roleAssignments
        .filter((a) => a.roleId === r.roleId)
        .map((a) => ({
          assignedTo: a.assignedTo || "",
          scopeType: a.scopeType || "",
        }))

      return {
        roleId: r.roleId || "",
        roleName: r.roleName || "",
        roleDescription: r.roleDescription || "",
        isSystemRole: r.isSystemRole || false,
        isSuperAdminRole: r.isSuperAdminRole || false,
        assignees,
      }
    })

    return NextResponse.json({ roles })
  } catch (error) {
    return serverError(error)
  }
}
