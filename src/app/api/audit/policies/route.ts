import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/audit/policies
 *
 * Lists organizational units and their associated policies.
 * Uses the Admin Directory API to enumerate OUs.
 */
export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const admin = createDirectoryServiceFromToken(accessToken)
    let scope: "organization" | "limited" = "organization"

    // Fetch organizational units (OUs)
    const orgUnits: Array<Record<string, unknown>> = []
    try {
      const res = await admin.orgunits.list({
        customerId: "my_customer",
        type: "all",
      })

      for (const ou of res.data.organizationUnits || []) {
        orgUnits.push({
          orgUnitId: ou.orgUnitId || "",
          name: ou.name || "",
          orgUnitPath: ou.orgUnitPath || "",
          parentOrgUnitPath: ou.parentOrgUnitPath || "",
          parentOrgUnitId: ou.parentOrgUnitId || "",
          description: ou.description || "",
          blockInheritance: ou.blockInheritance || false,
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

    // Fetch domain info for basic settings
    const domains: Array<Record<string, unknown>> = []
    try {
      const domainRes = await admin.domains.list({
        customer: "my_customer",
      })

      for (const d of domainRes.data.domains || []) {
        domains.push({
          domainName: d.domainName || "",
          isPrimary: d.isPrimary || false,
          verified: d.verified || false,
          creationTime: d.creationTime || "",
        })
      }
    } catch {
      // Non-critical, domain list may not be accessible
    }

    return NextResponse.json({
      orgUnits,
      domains,
      scope,
    })
  } catch (error) {
    return serverError(error)
  }
}
