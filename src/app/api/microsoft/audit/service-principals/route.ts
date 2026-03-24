import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated, graphJson } from "@/lib/microsoft"
import type { MicrosoftCredential } from "@/lib/providers/types"

export const dynamic = "force-dynamic"

type GraphServicePrincipal = {
  id: string
  appId: string
  displayName: string
  servicePrincipalType: string
  accountEnabled: boolean
}

type GraphOAuth2PermissionGrant = {
  id: string
  clientId: string
  consentType: string
  principalId: string | null
  scope: string
}

type GraphAppRoleAssignment = {
  id: string
  resourceDisplayName: string
  appRoleId: string
  principalDisplayName: string
}

type ServicePrincipalAuditEntry = {
  id: string
  appId: string
  displayName: string
  servicePrincipalType: string
  accountEnabled: boolean
  appRoleAssignments: { id: string; resourceDisplayName: string; appRoleId: string; principalDisplayName: string }[]
  delegatedPermissions: { scope: string; consentType: string; principalId?: string }[]
}

const BATCH_SIZE = 10

/**
 * Paginate all items from a Graph API endpoint.
 * Returns empty array on 401/403 (access denied).
 */
async function paginateAll<T>(
  credential: MicrosoftCredential,
  path: string,
  select?: string,
): Promise<T[]> {
  try {
    const items: T[] = []
    let pageToken: string | undefined
    do {
      const result = await graphPaginated<T>(credential, path, {
        select,
        top: 999,
        pageToken,
      })
      items.push(...result.value)
      pageToken = result.nextPageToken ?? undefined
    } while (pageToken)
    return items
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status: number }).status
      if (status === 403 || status === 401) return []
    }
    throw err
  }
}

/**
 * Batch-fetch appRoleAssignments for service principals that have delegated grants.
 * Uses concurrent batches of BATCH_SIZE to avoid overwhelming Graph API.
 */
async function fetchAppRoleAssignments(
  credential: MicrosoftCredential,
  spIds: string[],
): Promise<Map<string, GraphAppRoleAssignment[]>> {
  const map = new Map<string, GraphAppRoleAssignment[]>()

  for (let i = 0; i < spIds.length; i += BATCH_SIZE) {
    const batch = spIds.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (spId) => {
        const res = await graphJson<{ value: GraphAppRoleAssignment[] }>(
          credential,
          `/servicePrincipals/${spId}/appRoleAssignments`,
        )
        return { spId, assignments: res.value || [] }
      }),
    )

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        map.set(outcome.value.spId, outcome.value.assignments)
      }
      // Skip SPs where the fetch failed (permission denied, etc.)
    }
  }

  return map
}

export async function GET() {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    // Step 1: Fetch all service principals and delegated grants in parallel
    const [servicePrincipals, delegatedGrants] = await Promise.all([
      paginateAll<GraphServicePrincipal>(
        credential,
        "/servicePrincipals",
        "id,appId,displayName,servicePrincipalType,accountEnabled",
      ),
      paginateAll<GraphOAuth2PermissionGrant>(
        credential,
        "/oauth2PermissionGrants",
      ),
    ])

    // Step 2: Group delegated grants by clientId (service principal id)
    const grantsBySpId = new Map<string, GraphOAuth2PermissionGrant[]>()
    for (const grant of delegatedGrants) {
      const existing = grantsBySpId.get(grant.clientId) || []
      existing.push(grant)
      grantsBySpId.set(grant.clientId, existing)
    }

    // Step 3: Batch-fetch appRoleAssignments for SPs that have delegated grants
    const spIdsWithGrants = [...grantsBySpId.keys()]
    const roleAssignmentsMap = await fetchAppRoleAssignments(credential, spIdsWithGrants)

    // Step 4: Assemble response
    const entries: ServicePrincipalAuditEntry[] = servicePrincipals.map((sp) => {
      const grants = grantsBySpId.get(sp.id) || []
      const roleAssignments = roleAssignmentsMap.get(sp.id) || []

      return {
        id: sp.id,
        appId: sp.appId,
        displayName: sp.displayName,
        servicePrincipalType: sp.servicePrincipalType,
        accountEnabled: sp.accountEnabled,
        appRoleAssignments: roleAssignments.map((ra) => ({
          id: ra.id,
          resourceDisplayName: ra.resourceDisplayName,
          appRoleId: ra.appRoleId,
          principalDisplayName: ra.principalDisplayName,
        })),
        delegatedPermissions: grants.flatMap((g) =>
          g.scope
            .split(" ")
            .filter(Boolean)
            .map((scope) => ({
              scope,
              consentType: g.consentType,
              ...(g.principalId ? { principalId: g.principalId } : {}),
            })),
        ),
      }
    })

    return NextResponse.json({ servicePrincipals: entries })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
