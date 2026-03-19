import { NextResponse } from "next/server"
import { createDirectoryService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/audit/access-policies
 *
 * Lists context-aware access policies: domain-wide delegation,
 * API client access, and security settings from the admin directory.
 */
export async function GET() {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const admin = createDirectoryService(token)
    let scope: "organization" | "limited" = "organization"

    // Fetch domain-wide delegation (service account authorizations)
    const delegations: Array<Record<string, unknown>> = []
    try {
      // Use roleAssignments to find service accounts with roles
      const assignmentsRes = await admin.roleAssignments.list({
        customer: "my_customer",
      })
      const assignments = assignmentsRes.data.items || []

      // Also gather role info for context
      const rolesRes = await admin.roles.list({ customer: "my_customer" })
      const rolesMap = new Map<string, string>()
      for (const r of rolesRes.data.items || []) {
        if (r.roleId && r.roleName) {
          rolesMap.set(String(r.roleId), r.roleName)
        }
      }

      for (const a of assignments) {
        delegations.push({
          assignmentId: a.roleAssignmentId || "",
          assignedTo: a.assignedTo || "",
          roleId: a.roleId || "",
          roleName: rolesMap.get(String(a.roleId || "")) || "",
          scopeType: a.scopeType || "",
          orgUnitId: a.orgUnitId || "",
        })
      }
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err
        ? (err as { code: number }).code : 0
      if (code === 403) {
        scope = "limited"
      } else {
        throw err
      }
    }

    // Fetch security-related user settings (2FA enforcement, etc.)
    const securitySettings: Record<string, unknown> = {}
    try {
      // Get a sample of users to determine org-wide 2FA enforcement
      const usersRes = await admin.users.list({
        customer: "my_customer",
        maxResults: 50,
        projection: "full",
      })
      const users = usersRes.data.users || []
      const totalUsers = users.length
      const enrolledIn2fa = users.filter((u) => u.isEnrolledIn2Sv).length
      const enforcedIn2fa = users.filter((u) => u.isEnforcedIn2Sv).length

      securitySettings.sampleSize = totalUsers
      securitySettings.twoFactorEnrolled = enrolledIn2fa
      securitySettings.twoFactorEnforced = enforcedIn2fa
      securitySettings.twoFactorEnrollmentRate = totalUsers > 0
        ? Math.round((enrolledIn2fa / totalUsers) * 100)
        : 0
      securitySettings.twoFactorEnforcementRate = totalUsers > 0
        ? Math.round((enforcedIn2fa / totalUsers) * 100)
        : 0
    } catch {
      // Non-critical
    }

    // Fetch custom schemas (can reveal sensitive data models)
    const schemas: Array<Record<string, unknown>> = []
    try {
      const schemasRes = await admin.schemas.list({
        customerId: "my_customer",
      })
      for (const s of schemasRes.data.schemas || []) {
        schemas.push({
          schemaId: s.schemaId || "",
          schemaName: s.schemaName || "",
          displayName: s.displayName || "",
          fieldCount: (s.fields || []).length,
          fields: (s.fields || []).map((f) => ({
            fieldName: f.fieldName || "",
            fieldType: f.fieldType || "",
            readAccessType: f.readAccessType || "",
            multiValued: f.multiValued || false,
          })),
        })
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      delegations,
      securitySettings,
      schemas,
      scope,
    })
  } catch (error) {
    return serverError(error)
  }
}
