import {
  type AttackPathNode,
  type AttackPathEdge,
  type AttackPath,
  type AttackPathResult,
  NODE_COLORS,
  EDGE_STYLES,
} from "./attack-path-builder"
import type { GitLabAuditData } from "./gitlab-risk-scoring"

// Re-export EDGE_STYLES so consumers can use GitLab-specific edge styles
export { EDGE_STYLES }

// ── Extended node colors for GitLab ─────────────────────────────────

export const GITLAB_NODE_COLORS: Record<string, string> = {
  ...NODE_COLORS,
  project: "#f97316",    // orange — projects as primary entities
  runner: "#06b6d4",     // cyan — runners
  instance: "#8b5cf6",   // purple — GitLab instance root
}

// ── Builder ─────────────────────────────────────────────────────────

export function buildGitLabAttackPaths(
  data: GitLabAuditData
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

  // ── Instance root (virtual) ─────────────────────────────────────
  const instanceId = "domain:gitlab"
  addNode({
    id: instanceId,
    type: "domain",
    label: "GitLab Instance",
    metadata: { virtual: true },
  })

  // ── User node (token owner) ─────────────────────────────────────
  const userId = `user:${data.user.username}`
  const userRiskFactors: string[] = []
  let userRiskScore = 0

  if (data.user.isAdmin) {
    userRiskFactors.push("Instance Admin")
    userRiskScore += 50
  }
  if (!data.user.twoFactorEnabled) {
    userRiskFactors.push("No 2FA")
    userRiskScore += 30
  }

  addNode({
    id: userId,
    type: "user",
    label: data.user.username,
    metadata: {
      username: data.user.username,
      isAdmin: data.user.isAdmin,
      twoFactorEnabled: data.user.twoFactorEnabled,
    },
    riskScore: userRiskScore,
    riskFactors: userRiskFactors.length > 0 ? userRiskFactors : undefined,
  })

  if (data.user.isAdmin) {
    edges.push({
      id: `edge:${userId}:${instanceId}:admin`,
      source: userId,
      target: instanceId,
      type: "admin-of",
      riskWeight: 90,
    })
  }

  // ── Project nodes ───────────────────────────────────────────────
  const nonArchived = data.projects.filter((p) => !p.archived)

  for (const project of nonArchived) {
    const projectNodeId = `role:${project.id}`
    const riskFactors: string[] = []
    let riskScore = 0

    // Check if default branch is unprotected
    const protectedNames = project.protectedBranches.map((b) => b.name)
    const defaultUnprotected = project.defaultBranch && !protectedNames.includes(project.defaultBranch)
    if (defaultUnprotected) {
      riskFactors.push("Unprotected default branch")
      riskScore += 40
    }

    // Check for exposed CI/CD variables
    const exposedVars = project.variables.filter((v) => !v.masked && !v.protected)
    if (exposedVars.length > 0) {
      riskFactors.push(`${exposedVars.length} exposed CI/CD variable${exposedVars.length !== 1 ? "s" : ""}`)
      riskScore += 30
    }

    // Public visibility
    if (project.visibility === "public") {
      riskFactors.push("Public project")
      riskScore += 20
    }

    addNode({
      id: projectNodeId,
      type: "role",
      label: project.name,
      metadata: {
        pathWithNamespace: project.pathWithNamespace,
        visibility: project.visibility,
        defaultBranch: project.defaultBranch,
        protectedBranchCount: project.protectedBranches.length,
        variableCount: project.variables.length,
        hookCount: project.hooks.length,
        memberCount: project.members.length,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // User -> Project edge (if user is a member)
    edges.push({
      id: `edge:${userId}:${projectNodeId}:member`,
      source: userId,
      target: projectNodeId,
      type: "member-of",
      riskWeight: defaultUnprotected ? 60 : 20,
    })
  }

  // ── Group nodes ─────────────────────────────────────────────────
  for (const group of data.groupMembers) {
    const groupNodeId = `group:${group.groupId}`
    const owners = group.members.filter((m) => m.accessLevel >= 50)
    const riskFactors: string[] = []
    let riskScore = 0

    if (owners.length > 3) {
      riskFactors.push(`${owners.length} Owners`)
      riskScore += 30
    }

    addNode({
      id: groupNodeId,
      type: "group",
      label: group.groupName,
      metadata: {
        groupId: group.groupId,
        memberCount: group.members.length,
        ownerCount: owners.length,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // Group -> Instance edge
    edges.push({
      id: `edge:${groupNodeId}:${instanceId}:member`,
      source: groupNodeId,
      target: instanceId,
      type: "member-of",
      riskWeight: 20,
    })
  }

  // ── Runner nodes ────────────────────────────────────────────────
  const nonSharedRunners = data.runners.filter(
    (r) => r.runnerType !== "instance_type"
  )

  for (const runner of nonSharedRunners) {
    const runnerNodeId = `service-account:runner-${runner.id}`
    const riskFactors: string[] = []
    let riskScore = 20

    if (runner.tagList.length === 0) {
      riskFactors.push("No tag restrictions")
      riskScore += 20
    }

    addNode({
      id: runnerNodeId,
      type: "service-account",
      label: runner.description || `Runner #${runner.id}`,
      metadata: {
        runnerId: runner.id,
        runnerType: runner.runnerType,
        active: runner.active,
        isShared: runner.isShared,
        tags: runner.tagList,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // Runner -> Instance edge
    edges.push({
      id: `edge:${runnerNodeId}:${instanceId}:delegated`,
      source: runnerNodeId,
      target: instanceId,
      type: "delegated",
      riskWeight: 40,
    })
  }

  // ── Attack Chains ───────────────────────────────────────────────

  // Chain 1 (Critical): PAT -> unprotected projects -> code injection
  const unprotectedProjects = nonArchived.filter((p) => {
    const protectedNames = p.protectedBranches.map((b) => b.name)
    return p.defaultBranch && !protectedNames.includes(p.defaultBranch)
  })

  if (unprotectedProjects.length > 0) {
    const topProjects = unprotectedProjects.slice(0, 3)
    const projectNames = topProjects.map((p) => p.pathWithNamespace).join(", ")
    const overflow = unprotectedProjects.length > 3
      ? ` (+${unprotectedProjects.length - 3} more)`
      : ""

    highlightedPaths.push({
      id: "path:pat-unprotected-code-injection",
      label: "PAT to Code Injection via Unprotected Branches",
      severity: "critical",
      nodeIds: [
        userId,
        ...topProjects.map((p) => `role:${p.id}`),
      ],
      description: `Compromised PAT can push directly to unprotected default branches in ${projectNames}${overflow}. Attacker can inject malicious code into CI/CD pipelines.`,
    })
  }

  // Chain 2 (High): Unmasked CI/CD variables -> secret exfiltration
  const projectsWithExposedVars = nonArchived.filter((p) =>
    p.variables.some((v) => !v.masked && !v.protected)
  )

  if (projectsWithExposedVars.length > 0) {
    const topProjects = projectsWithExposedVars.slice(0, 3)
    const totalExposedVars = projectsWithExposedVars.reduce(
      (sum, p) => sum + p.variables.filter((v) => !v.masked && !v.protected).length,
      0
    )

    highlightedPaths.push({
      id: "path:cicd-variable-exfiltration",
      label: "CI/CD Variable Secret Exfiltration",
      severity: "high",
      nodeIds: [
        userId,
        ...topProjects.map((p) => `role:${p.id}`),
      ],
      description: `${totalExposedVars} CI/CD variable${totalExposedVars !== 1 ? "s" : ""} across ${projectsWithExposedVars.length} project${projectsWithExposedVars.length !== 1 ? "s" : ""} are neither masked nor protected. Pipeline logs or forks may leak secrets.`,
    })
  }

  // Chain 3 (High): Project runner -> host compromise
  if (nonSharedRunners.length > 0) {
    const topRunners = nonSharedRunners.slice(0, 3)
    const runnerNodeIds = topRunners.map((r) => `service-account:runner-${r.id}`)

    highlightedPaths.push({
      id: "path:runner-host-compromise",
      label: "Project Runner Host Compromise",
      severity: "high",
      nodeIds: [userId, ...runnerNodeIds, instanceId],
      description: `${nonSharedRunners.length} non-shared runner${nonSharedRunners.length !== 1 ? "s" : ""} execute arbitrary pipeline code. If a runner shares a host with other services, lateral movement is possible.`,
    })
  }

  // Chain 4 (Medium): Group membership inheritance -> unintended access
  const groupsWithManyOwners = data.groupMembers.filter(
    (g) => g.members.filter((m) => m.accessLevel >= 50).length > 3
  )

  if (groupsWithManyOwners.length > 0) {
    const topGroups = groupsWithManyOwners.slice(0, 3)
    const groupNodeIds = topGroups.map((g) => `group:${g.groupId}`)

    highlightedPaths.push({
      id: "path:group-inheritance-access",
      label: "Group Membership Inheritance",
      severity: "medium",
      nodeIds: [...groupNodeIds, instanceId],
      description: `${groupsWithManyOwners.length} group${groupsWithManyOwners.length !== 1 ? "s" : ""} have >3 Owners. Group-level permissions cascade to all child projects, expanding attack surface through inheritance.`,
    })
  }

  return { nodes, edges, highlightedPaths }
}
