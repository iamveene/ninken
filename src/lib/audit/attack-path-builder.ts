import type {
  AuditUser,
  AuditGroup,
  AuditRole,
  AuditDelegation,
} from "@/hooks/use-audit"

// ── Types ───────────────────────────────────────────────────────────

export type AttackPathNodeType =
  | "user"
  | "group"
  | "role"
  | "service-account"
  | "domain"
  | "service-principal"
  | "tenant"
  | "application"

export type AttackPathEdgeType =
  | "member-of"
  | "role-assignment"
  | "admin-of"
  | "delegated"
  | "external-access"

export type AttackPathNode = {
  id: string
  type: AttackPathNodeType
  label: string
  metadata: Record<string, unknown>
  riskScore?: number
  riskFactors?: string[]
}

export type AttackPathEdge = {
  id: string
  source: string
  target: string
  type: AttackPathEdgeType
  riskWeight?: number
}

export type AttackPath = {
  id: string
  label: string
  severity: "critical" | "high" | "medium"
  nodeIds: string[]
  description: string
}

export type AttackPathResult = {
  nodes: AttackPathNode[]
  edges: AttackPathEdge[]
  highlightedPaths: AttackPath[]
}

// ── Visual config ───────────────────────────────────────────────────

export const NODE_COLORS: Record<AttackPathNodeType, string> = {
  user: "#3b82f6",
  group: "#22c55e",
  role: "#ef4444",
  "service-account": "#f97316",
  domain: "#8b5cf6",
  "service-principal": "#f97316",   // orange — same as service-account
  tenant: "#8b5cf6",               // purple — same as domain
  application: "#06b6d4",          // cyan
}

export const EDGE_STYLES: Record<
  AttackPathEdgeType,
  { dashArray: string; strokeWidth: number; color: string }
> = {
  "member-of": { dashArray: "none", strokeWidth: 1.5, color: "#6b7280" },
  "role-assignment": { dashArray: "8,3,2,3", strokeWidth: 1.5, color: "#ef4444" },
  "admin-of": { dashArray: "none", strokeWidth: 2.5, color: "#ef4444" },
  delegated: { dashArray: "2,4", strokeWidth: 1.5, color: "#f97316" },
  "external-access": { dashArray: "6,3", strokeWidth: 1.5, color: "#ef4444" },
}

function hasBroadDelegationScopes(scopes: string[]): boolean {
  return scopes.some(
    (s) =>
      s.includes("admin.directory") ||
      s.includes("gmail") ||
      s.includes("drive") ||
      s === "https://www.googleapis.com/auth/cloud-platform",
  )
}

// ── Builder ─────────────────────────────────────────────────────────

export function buildAuditAttackPaths(
  users: AuditUser[],
  groups: AuditGroup[],
  roles: AuditRole[],
  delegations: AuditDelegation[],
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

  // ── Domain (virtual root) ──────────────────────────────────────
  const domainId = "domain:org"
  addNode({
    id: domainId,
    type: "domain",
    label: "Domain",
    metadata: { virtual: true },
  })

  // Build a set of assignee identifiers from roles
  const roleAssigneeIds = new Set<string>()
  for (const r of roles) {
    for (const a of r.assignees) {
      roleAssigneeIds.add(a.assignedTo)
    }
  }

  const isInteresting = (u: AuditUser) =>
    u.isAdmin ||
    u.isDelegatedAdmin ||
    !u.isEnrolledIn2Sv ||
    u.suspended ||
    roleAssigneeIds.has(u.primaryEmail)

  const filteredUsers =
    users.length > 500 ? users.filter(isInteresting) : users

  // ── Users ──────────────────────────────────────────────────────
  for (const u of filteredUsers) {
    const riskFactors: string[] = []
    let riskScore = 0

    if (!u.isEnrolledIn2Sv) {
      riskFactors.push("No 2FA enrollment")
      riskScore += 30
    }
    if (u.isAdmin) {
      riskFactors.push("Super Admin")
      riskScore += 50
    }
    if (u.isDelegatedAdmin) {
      riskFactors.push("Delegated Admin")
      riskScore += 30
    }
    if (u.suspended) {
      riskFactors.push("Suspended account")
      riskScore += 10
    }

    addNode({
      id: `user:${u.primaryEmail}`,
      type: "user",
      label: u.fullName || u.primaryEmail,
      metadata: {
        email: u.primaryEmail,
        fullName: u.fullName,
        isAdmin: u.isAdmin,
        isDelegatedAdmin: u.isDelegatedAdmin,
        isEnrolledIn2Sv: u.isEnrolledIn2Sv,
        isEnforcedIn2Sv: u.isEnforcedIn2Sv,
        suspended: u.suspended,
        lastLoginTime: u.lastLoginTime,
        orgUnitPath: u.orgUnitPath,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })
  }

  // ── Groups ─────────────────────────────────────────────────────
  for (const g of groups) {
    addNode({
      id: `group:${g.id}`,
      type: "group",
      label: g.name || g.email,
      metadata: {
        email: g.email,
        directMembersCount: g.directMembersCount,
        description: g.description,
      },
    })
  }

  // ── Roles & role-assignment edges ──────────────────────────────
  for (const r of roles) {
    const roleNodeId = `role:${r.roleId}`
    const riskFactors: string[] = []
    let riskScore = 0

    if (r.isSuperAdminRole) {
      riskFactors.push("Super Admin role")
      riskScore += 80
    }
    if (r.isSystemRole) {
      riskFactors.push("System role")
    }

    addNode({
      id: roleNodeId,
      type: "role",
      label: r.roleName,
      metadata: {
        roleId: r.roleId,
        isSystemRole: r.isSystemRole,
        isSuperAdminRole: r.isSuperAdminRole,
        roleDescription: r.roleDescription,
        assigneeCount: r.assignees.length,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    for (const a of r.assignees) {
      const userNodeId = `user:${a.assignedTo}`
      // Ensure the user node exists (may be a user ID not in the filtered list)
      if (!nodeIds.has(userNodeId)) {
        addNode({
          id: userNodeId,
          type: "user",
          label: a.assignedTo,
          metadata: { assignedTo: a.assignedTo },
        })
      }

      edges.push({
        id: `edge:${userNodeId}:${roleNodeId}`,
        source: userNodeId,
        target: roleNodeId,
        type: "role-assignment",
        riskWeight: r.isSuperAdminRole ? 90 : 40,
      })
    }
  }

  // ── Admin edges ────────────────────────────────────────────────
  for (const u of filteredUsers) {
    if (!u.isAdmin && !u.isDelegatedAdmin) continue
    edges.push({
      id: `edge:user:${u.primaryEmail}:${domainId}:admin`,
      source: `user:${u.primaryEmail}`,
      target: domainId,
      type: "admin-of",
      riskWeight: u.isAdmin ? 90 : 60,
    })
  }

  // ── Delegation ─────────────────────────────────────────────────
  for (const d of delegations) {
    const saNodeId = `sa:${d.serviceAccountId}`
    const scopeCount = d.scopes.length
    const riskFactors: string[] = []
    let riskScore = 0

    const hasBroadScopes = hasBroadDelegationScopes(d.scopes)
    if (hasBroadScopes) {
      riskFactors.push("Broad API scopes")
      riskScore += 60
    }
    if (scopeCount > 5) {
      riskFactors.push(`${scopeCount} scopes delegated`)
      riskScore += 20
    }

    addNode({
      id: saNodeId,
      type: "service-account",
      label: d.serviceAccountId,
      metadata: {
        serviceAccountId: d.serviceAccountId,
        scopes: d.scopes,
        scopeCount,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    edges.push({
      id: `edge:${saNodeId}:${domainId}:delegated`,
      source: saNodeId,
      target: domainId,
      type: "delegated",
      riskWeight: hasBroadScopes ? 80 : 40,
    })
  }

  // ── Compute attack chains ─────────────────────────────────────

  // Chain 1: User (no 2FA) -> Role (Super Admin) -> Domain
  const superAdminRoles = roles.filter((r) => r.isSuperAdminRole)
  for (const role of superAdminRoles) {
    for (const assignee of role.assignees) {
      const user = filteredUsers.find(
        (u) => u.primaryEmail === assignee.assignedTo,
      )
      if (user && !user.isEnrolledIn2Sv) {
        const pathNodeIds = [
          `user:${user.primaryEmail}`,
          `role:${role.roleId}`,
          domainId,
        ]
        highlightedPaths.push({
          id: `path:privesc:${user.primaryEmail}`,
          label: `Privilege Escalation: ${user.primaryEmail}`,
          severity: "critical",
          nodeIds: pathNodeIds,
          description: `${user.fullName || user.primaryEmail} has Super Admin role without 2FA. An attacker who compromises their credentials gains full domain control.`,
        })
      }
    }
  }

  // Chain 2: Service Account -> DWD -> Domain (broad scopes)
  for (const d of delegations) {
    if (hasBroadDelegationScopes(d.scopes)) {
      const pathNodeIds = [`sa:${d.serviceAccountId}`, domainId]
      highlightedPaths.push({
        id: `path:dwd:${d.serviceAccountId}`,
        label: `DWD Lateral Movement: ${d.serviceAccountId.split("@")[0]}`,
        severity: "high",
        nodeIds: pathNodeIds,
        description: `Service account ${d.serviceAccountId} has domain-wide delegation with ${d.scopes.length} scope(s) including sensitive API access. Can impersonate any user.`,
      })
    }
  }

  // Chain 3: Admins without 2FA -> Domain (even without Super Admin role)
  for (const u of filteredUsers) {
    if ((u.isAdmin || u.isDelegatedAdmin) && !u.isEnrolledIn2Sv) {
      // Only add if not already covered by chain 1 (Super Admin role)
      const alreadyCovered = highlightedPaths.some(
        (p) => p.id === `path:privesc:${u.primaryEmail}`,
      )
      if (!alreadyCovered) {
        const pathNodeIds = [`user:${u.primaryEmail}`, domainId]
        highlightedPaths.push({
          id: `path:admin-no2fa:${u.primaryEmail}`,
          label: `Admin Without 2FA: ${u.primaryEmail}`,
          severity: "high",
          nodeIds: pathNodeIds,
          description: `${u.fullName || u.primaryEmail} is a${u.isAdmin ? " Super" : " Delegated"} Admin without 2FA enrollment. Credential compromise gives admin access to the domain.`,
        })
      }
    }
  }

  return { nodes, edges, highlightedPaths }
}
