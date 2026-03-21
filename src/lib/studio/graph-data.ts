import type { GraphNode, GraphEdge, AttackGraph } from "./graph-types"
import type {
  AuditUser,
  AuditGroup,
  AuditRole,
  AuditApp,
  AuditDelegation,
} from "@/hooks/use-audit"

// ── Fetch helpers (swallow errors — graph is best-effort) ───────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Fetch data from all available audit endpoints and normalize into a
 * unified attack-path graph.  Each fetch is independent — failures are
 * silently ignored so the graph renders whatever data is available.
 */
export async function buildAttackGraph(): Promise<AttackGraph> {
  const [usersRes, groupsRes, rolesRes, appsRes, delegRes] = await Promise.all([
    fetchJson<{ users: AuditUser[] }>("/api/audit/users"),
    fetchJson<{ groups: AuditGroup[] }>("/api/audit/groups"),
    fetchJson<{ roles: AuditRole[] }>("/api/audit/roles"),
    fetchJson<{ apps: AuditApp[] }>("/api/audit/apps"),
    fetchJson<{ delegations: AuditDelegation[] }>("/api/audit/delegation"),
  ])

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeIds = new Set<string>()

  function addNode(node: GraphNode) {
    if (nodeIds.has(node.id)) return
    nodeIds.add(node.id)
    nodes.push(node)
  }

  // ── Users ───────────────────────────────────────────────────────
  const users = usersRes?.users ?? []
  for (const u of users) {
    addNode({
      id: `google:user:${u.primaryEmail}`,
      label: u.fullName || u.primaryEmail,
      type: "user",
      provider: "google",
      metadata: {
        email: u.primaryEmail,
        isAdmin: u.isAdmin,
        isDelegatedAdmin: u.isDelegatedAdmin,
        suspended: u.suspended,
        orgUnitPath: u.orgUnitPath,
      },
    })
  }

  // ── Groups ──────────────────────────────────────────────────────
  const groups = groupsRes?.groups ?? []
  for (const g of groups) {
    addNode({
      id: `google:group:${g.id}`,
      label: g.name || g.email,
      type: "group",
      provider: "google",
      metadata: {
        email: g.email,
        directMembersCount: g.directMembersCount,
      },
    })
  }

  // ── Roles & role-assignments ────────────────────────────────────
  const roles = rolesRes?.roles ?? []
  for (const r of roles) {
    const roleNodeId = `google:role:${r.roleId}`
    addNode({
      id: roleNodeId,
      label: r.roleName,
      type: "role",
      provider: "google",
      metadata: {
        isSystemRole: r.isSystemRole,
        isSuperAdminRole: r.isSuperAdminRole,
      },
    })

    for (const a of r.assignees) {
      // assignedTo is a user ID — try to match by email in existing nodes
      const userNode = nodes.find(
        (n) =>
          n.type === "user" &&
          n.provider === "google" &&
          (n.id === `google:user:${a.assignedTo}` ||
            (n.metadata?.email as string) === a.assignedTo)
      )
      const sourceId = userNode?.id ?? `google:user:${a.assignedTo}`
      if (!nodeIds.has(sourceId)) {
        addNode({
          id: sourceId,
          label: a.assignedTo,
          type: "user",
          provider: "google",
          metadata: { assignedTo: a.assignedTo },
        })
      }

      edges.push({
        source: sourceId,
        target: roleNodeId,
        type: "role-assignment",
        label: a.scopeType || undefined,
      })
    }
  }

  // ── Apps (OAuth grants) ─────────────────────────────────────────
  const apps = appsRes?.apps ?? []
  for (const app of apps) {
    const appNodeId = `google:app:${app.clientId}`
    addNode({
      id: appNodeId,
      label: app.displayText || app.clientId,
      type: "app",
      provider: "google",
      metadata: {
        clientId: app.clientId,
        scopes: app.scopes,
      },
    })

    // Link user → app with permission edge
    const userNodeId = `google:user:${app.userKey}`
    if (!nodeIds.has(userNodeId)) {
      addNode({
        id: userNodeId,
        label: app.userKey,
        type: "user",
        provider: "google",
      })
    }
    edges.push({
      source: userNodeId,
      target: appNodeId,
      type: "permission",
      label: `${app.scopes.length} scope(s)`,
    })
  }

  // ── Shared virtual org node (used by delegation + admin edges) ──
  const orgNodeId = "google:org:domain"
  function ensureOrgNode() {
    addNode({
      id: orgNodeId,
      label: "Domain",
      type: "group",
      provider: "google",
      metadata: { virtual: true },
    })
  }

  // ── Delegation ──────────────────────────────────────────────────
  const delegations = delegRes?.delegations ?? []
  for (const d of delegations) {
    const saNodeId = `google:sa:${d.serviceAccountId}`
    addNode({
      id: saNodeId,
      label: d.serviceAccountId,
      type: "service-account",
      provider: "google",
      metadata: { scopes: d.scopes },
    })

    ensureOrgNode()
    edges.push({
      source: saNodeId,
      target: orgNodeId,
      type: "delegated",
      label: `${d.scopes.length} scope(s)`,
    })
  }

  // ── Admin edges (users flagged as admin) ────────────────────────
  for (const u of users) {
    if (!u.isAdmin && !u.isDelegatedAdmin) continue
    ensureOrgNode()
    edges.push({
      source: `google:user:${u.primaryEmail}`,
      target: orgNodeId,
      type: "admin-of",
      label: u.isDelegatedAdmin ? "Delegated Admin" : "Super Admin",
    })
  }

  return { nodes, edges }
}
