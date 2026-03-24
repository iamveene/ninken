import {
  type AttackPathNode,
  type AttackPathEdge,
  type AttackPath,
  type AttackPathResult,
  NODE_COLORS,
  EDGE_STYLES,
} from "./attack-path-builder"

// Re-export EDGE_STYLES so consumers can use M365-specific edge styles
export { EDGE_STYLES }

// ── Extended node colors for M365 ──────────────────────────────────────

export const M365_NODE_COLORS: Record<string, string> = {
  ...NODE_COLORS,
  "service-principal": "#f97316",
  application: "#06b6d4",
  tenant: "#8b5cf6",
}

// ── Input types (matching hooks) ───────────────────────────────────────

type AuthMethodUser = {
  id: string
  displayName: string
  userPrincipalName: string
  methods: { odataType: string; id: string }[]
}

type EntraRole = {
  id: string
  displayName: string
  description?: string
  isBuiltIn?: boolean
  members: { id: string; displayName: string; userPrincipalName?: string }[]
}

type EntraGroup = {
  id: string
  displayName: string
  groupTypes: string[]
  securityEnabled: boolean
}

type ConditionalAccessPolicy = {
  id: string
  displayName: string
  state: string
  conditions: {
    users?: {
      includeUsers?: string[]
      includeRoles?: string[]
    }
    applications?: {
      includeApplications?: string[]
    }
  }
  grantControls: {
    builtInControls?: string[]
  } | null
}

type CrossTenantPartner = {
  tenantId: string
  inboundTrust?: { isMfaAccepted?: boolean }
}

type RiskyUser = {
  id: string
  userDisplayName: string | null
  userPrincipalName: string | null
  riskLevel: string
  riskState: string
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

// ── Helpers ────────────────────────────────────────────────────────────

const STRONG_MFA_TYPES = new Set([
  "#microsoft.graph.fido2AuthenticationMethod",
  "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod",
  "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod",
  "#microsoft.graph.softwareOathAuthenticationMethod",
])

const WEAK_MFA_TYPES = new Set([
  "#microsoft.graph.phoneAuthenticationMethod",
  "#microsoft.graph.emailAuthenticationMethod",
])

const PASSWORD_TYPE = "#microsoft.graph.passwordAuthenticationMethod"

function hasStrongMFA(methods: { odataType: string }[]): boolean {
  return methods.some((m) => STRONG_MFA_TYPES.has(m.odataType))
}

function hasNoMFA(methods: { odataType: string }[]): boolean {
  const nonPassword = methods.filter((m) => m.odataType !== PASSWORD_TYPE)
  return nonPassword.length === 0
}

function isWeakMFAOnly(methods: { odataType: string }[]): boolean {
  if (hasStrongMFA(methods)) return false
  const nonPassword = methods.filter((m) => m.odataType !== PASSWORD_TYPE)
  return nonPassword.length > 0 && nonPassword.every((m) => WEAK_MFA_TYPES.has(m.odataType))
}

const DANGEROUS_SCOPES = new Set([
  "Directory.ReadWrite.All",
  "Mail.ReadWrite",
  "Mail.Send",
  "Files.ReadWrite.All",
  "User.ReadWrite.All",
  "Application.ReadWrite.All",
  "RoleManagement.ReadWrite.Directory",
  "Sites.ReadWrite.All",
  "Group.ReadWrite.All",
  "MailboxSettings.ReadWrite",
])

function spHasDangerousPermissions(sp: ServicePrincipalAuditEntry): boolean {
  return sp.delegatedPermissions.some((p) => DANGEROUS_SCOPES.has(p.scope))
}

// ── Builder ────────────────────────────────────────────────────────────

export function buildM365AttackPaths(
  authMethodUsers: AuthMethodUser[],
  groups: EntraGroup[],
  roles: EntraRole[],
  servicePrincipals: ServicePrincipalAuditEntry[],
  policies: ConditionalAccessPolicy[],
  crossTenantPartners: CrossTenantPartner[],
  riskyUsers: RiskyUser[],
): AttackPathResult {
  const nodes: AttackPathNode[] = []
  const edges: AttackPathEdge[] = []
  const highlightedPaths: AttackPath[] = []
  const nodeIds = new Set<string>()

  function addNode(node: AttackPathNode) {
    if (nodeIds.has(node.id)) return
    nodeIds.add(node.id)
    nodes.push(node)
  }

  // ── Tenant node (virtual root) ──────────────────────────────────
  const tenantId = "tenant:org"
  addNode({
    id: tenantId,
    type: "domain",
    label: "Tenant",
    metadata: { virtual: true },
  })

  // ── Build lookup sets ───────────────────────────────────────────

  // Users who hold any role
  const roleMemberIds = new Set<string>()
  for (const r of roles) {
    for (const m of r.members) {
      roleMemberIds.add(m.id)
    }
  }

  // Users flagged as risky
  const riskyUserIds = new Set(riskyUsers.map((u) => u.id))

  // Filter to "interesting" users when tenant is large (>500 users)
  const isInteresting = (u: AuthMethodUser) =>
    roleMemberIds.has(u.id) ||
    riskyUserIds.has(u.id) ||
    hasNoMFA(u.methods) ||
    isWeakMFAOnly(u.methods)

  const filteredUsers =
    authMethodUsers.length > 500
      ? authMethodUsers.filter(isInteresting)
      : authMethodUsers

  // Global Admin role reference
  const globalAdminRole = roles.find((r) => r.displayName === "Global Administrator")
  const globalAdminIds = new Set(globalAdminRole?.members.map((m) => m.id) ?? [])

  const privilegedRoleAdminRole = roles.find((r) => r.displayName === "Privileged Role Administrator")
  const privilegedRoleAdminIds = new Set(privilegedRoleAdminRole?.members.map((m) => m.id) ?? [])

  // ── User nodes ──────────────────────────────────────────────────
  for (const u of filteredUsers) {
    const riskFactors: string[] = []
    let riskScore = 0

    if (hasNoMFA(u.methods)) {
      riskFactors.push("No MFA")
      riskScore += 30
    } else if (isWeakMFAOnly(u.methods)) {
      riskFactors.push("Phone-only MFA")
      riskScore += 20
    }

    if (globalAdminIds.has(u.id)) {
      riskFactors.push("Global Administrator")
      riskScore += 50
    }

    if (privilegedRoleAdminIds.has(u.id)) {
      riskFactors.push("Privileged Role Administrator")
      riskScore += 30
    }

    if (riskyUserIds.has(u.id)) {
      riskFactors.push("Flagged as risky by Identity Protection")
      riskScore += 20
    }

    addNode({
      id: `user:${u.id}`,
      type: "user",
      label: u.displayName || u.userPrincipalName,
      metadata: {
        userPrincipalName: u.userPrincipalName,
        displayName: u.displayName,
        methodCount: u.methods.length,
        hasStrongMFA: hasStrongMFA(u.methods),
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })
  }

  // ── Role nodes ──────────────────────────────────────────────────
  for (const r of roles) {
    if (r.members.length === 0) continue

    const riskFactors: string[] = []
    let riskScore = 0

    if (r.displayName === "Global Administrator") {
      riskFactors.push("Global Administrator role")
      riskScore += 80
    } else if (r.displayName === "Privileged Role Administrator") {
      riskFactors.push("Privileged Role Administrator role")
      riskScore += 60
    }

    const roleNodeId = `role:${r.id}`
    addNode({
      id: roleNodeId,
      type: "role",
      label: r.displayName,
      metadata: {
        roleId: r.id,
        isBuiltIn: r.isBuiltIn,
        description: r.description,
        memberCount: r.members.length,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // role-assignment edges: user -> role
    for (const m of r.members) {
      const userNodeId = `user:${m.id}`
      // Ensure user node exists (may not be in filteredUsers)
      if (!nodeIds.has(userNodeId)) {
        addNode({
          id: userNodeId,
          type: "user",
          label: m.displayName || m.userPrincipalName || m.id,
          metadata: {
            userPrincipalName: m.userPrincipalName,
            displayName: m.displayName,
          },
        })
      }

      edges.push({
        id: `edge:${userNodeId}:${roleNodeId}`,
        source: userNodeId,
        target: roleNodeId,
        type: "role-assignment",
        riskWeight: r.displayName === "Global Administrator" ? 90 : 40,
      })
    }
  }

  // ── Admin-of edges: Global Admins -> Tenant ─────────────────────
  if (globalAdminRole) {
    for (const m of globalAdminRole.members) {
      edges.push({
        id: `edge:user:${m.id}:${tenantId}:admin`,
        source: `user:${m.id}`,
        target: tenantId,
        type: "admin-of",
        riskWeight: 90,
      })
    }
  }

  // ── Service Principal nodes ─────────────────────────────────────
  for (const sp of servicePrincipals) {
    if (sp.delegatedPermissions.length === 0 && sp.appRoleAssignments.length === 0) continue

    const riskFactors: string[] = []
    let riskScore = 0

    const isDangerous = spHasDangerousPermissions(sp)
    if (isDangerous) {
      riskFactors.push("Dangerous API permissions")
      riskScore += 60
    }

    const totalPermissions = sp.delegatedPermissions.length + sp.appRoleAssignments.length
    if (totalPermissions > 5) {
      riskFactors.push(`${totalPermissions} total permissions`)
      riskScore += 20
    }

    const spNodeId = `sp:${sp.id}`
    addNode({
      id: spNodeId,
      type: "service-account",
      label: sp.displayName,
      metadata: {
        appId: sp.appId,
        servicePrincipalType: sp.servicePrincipalType,
        accountEnabled: sp.accountEnabled,
        delegatedPermissionCount: sp.delegatedPermissions.length,
        appRoleAssignmentCount: sp.appRoleAssignments.length,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // app-role-assignment edge: SP with dangerous permissions -> Tenant
    if (isDangerous) {
      edges.push({
        id: `edge:${spNodeId}:${tenantId}:app-role`,
        source: spNodeId,
        target: tenantId,
        type: "delegated",
        riskWeight: 80,
      })
    }
  }

  // ── Group nodes (security groups only) ──────────────────────────
  const securityGroups = groups.filter((g) => g.securityEnabled)
  for (const g of securityGroups) {
    addNode({
      id: `group:${g.id}`,
      type: "group",
      label: g.displayName,
      metadata: {
        groupId: g.id,
        groupTypes: g.groupTypes,
        securityEnabled: g.securityEnabled,
      },
    })
  }

  // ── Compute attack chains ──────────────────────────────────────

  // Chain 1 (Critical): User without MFA -> Global Admin -> Tenant
  if (globalAdminRole) {
    for (const member of globalAdminRole.members) {
      const user = filteredUsers.find((u) => u.id === member.id)
      if (user && (hasNoMFA(user.methods) || isWeakMFAOnly(user.methods))) {
        const mfaStatus = hasNoMFA(user.methods) ? "no MFA" : "phone-only MFA"
        highlightedPaths.push({
          id: `path:privesc:${user.id}`,
          label: `Privilege Escalation: ${user.displayName || user.userPrincipalName}`,
          severity: "critical",
          nodeIds: [
            `user:${user.id}`,
            `role:${globalAdminRole.id}`,
            tenantId,
          ],
          description: `${user.displayName || user.userPrincipalName} has Global Administrator role with ${mfaStatus}. Credential compromise grants full tenant control.`,
        })
      }
    }
  }

  // Chain 2 (High): Service Principal with broad app permissions -> Tenant
  for (const sp of servicePrincipals) {
    if (spHasDangerousPermissions(sp)) {
      const dangerousScopes = sp.delegatedPermissions
        .map((p) => p.scope)
        .filter((s) => DANGEROUS_SCOPES.has(s))

      highlightedPaths.push({
        id: `path:sp-overperm:${sp.id}`,
        label: `Over-Permissioned App: ${sp.displayName}`,
        severity: "high",
        nodeIds: [`sp:${sp.id}`, tenantId],
        description: `Service principal "${sp.displayName}" has dangerous delegated permissions: ${dangerousScopes.join(", ")}. Compromise of this app grants broad tenant access.`,
      })
    }
  }

  // Chain 3 (High): No CA policy enforcing MFA for admin roles
  const enforcedPolicies = policies.filter((p) => p.state === "enabled")
  const hasAdminMfaPolicy = enforcedPolicies.some(
    (p) =>
      (p.conditions.users?.includeRoles?.length ?? 0) > 0 &&
      p.grantControls?.builtInControls?.includes("mfa"),
  )

  if (!hasAdminMfaPolicy && globalAdminRole && globalAdminRole.members.length > 0) {
    highlightedPaths.push({
      id: "path:no-admin-ca-mfa",
      label: "Missing Admin MFA Conditional Access",
      severity: "high",
      nodeIds: [tenantId],
      description: `No Conditional Access policy enforces MFA for privileged admin roles. ${globalAdminRole.members.length} Global Admin(s) may authenticate without MFA challenge.`,
    })
  }

  // Chain 4 (Medium): Cross-tenant trust with MFA acceptance
  for (const partner of crossTenantPartners) {
    if (partner.inboundTrust?.isMfaAccepted) {
      highlightedPaths.push({
        id: `path:cross-tenant:${partner.tenantId}`,
        label: `Cross-Tenant MFA Trust: ${partner.tenantId}`,
        severity: "medium",
        nodeIds: [tenantId],
        description: `Cross-tenant access policy trusts MFA from external tenant ${partner.tenantId}. An attacker controlling that tenant's MFA can bypass this tenant's MFA requirements.`,
      })
    }
  }

  return { nodes, edges, highlightedPaths }
}
