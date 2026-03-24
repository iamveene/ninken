import {
  type AttackPathNode,
  type AttackPathEdge,
  type AttackPath,
  type AttackPathResult,
  NODE_COLORS,
  EDGE_STYLES,
} from "./attack-path-builder"
import type { GitHubAuditData } from "./github-risk-scoring"

// Re-export EDGE_STYLES so consumers can use GitHub-specific edge styles
export { EDGE_STYLES }

// ── Extended node colors for GitHub ─────────────────────────────────

export const GITHUB_NODE_COLORS: Record<string, string> = {
  ...NODE_COLORS,
  // repo reuses "role" color (red) to distinguish from users
  // runner reuses "service-account" (orange)
  // app reuses "application" (cyan)
  // org reuses "domain" (purple, virtual root)
}

// ── Builder ─────────────────────────────────────────────────────────

export function buildGitHubAttackPaths(
  data: GitHubAuditData,
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

  // ── User node ────────────────────────────────────────────────────
  const userNodeId = `user:${data.user.login}`
  const userRiskFactors: string[] = []
  let userRiskScore = 0

  if (data.user.twoFactorAuthentication === false) {
    userRiskFactors.push("2FA disabled")
    userRiskScore += 40
  }

  addNode({
    id: userNodeId,
    type: "user",
    label: data.user.login,
    metadata: {
      login: data.user.login,
      twoFactorAuthentication: data.user.twoFactorAuthentication,
    },
    riskScore: userRiskScore,
    riskFactors: userRiskFactors.length > 0 ? userRiskFactors : undefined,
  })

  // ── Org nodes (virtual roots) ────────────────────────────────────
  const orgNames = new Set(data.orgMembers.map((m) => m.org))
  for (const org of orgNames) {
    const orgNodeId = `domain:${org}`
    addNode({
      id: orgNodeId,
      type: "domain",
      label: org,
      metadata: { virtual: true, orgName: org },
    })

    // Edge: user -> org membership
    const memberEntry = data.orgMembers.find((m) => m.org === org && m.login === data.user.login)
    if (memberEntry) {
      edges.push({
        id: `edge:${userNodeId}:${orgNodeId}:member`,
        source: userNodeId,
        target: orgNodeId,
        type: memberEntry.role === "admin" ? "admin-of" : "member-of",
        riskWeight: memberEntry.role === "admin" ? 80 : 20,
      })
    }
  }

  // ── Repo nodes ───────────────────────────────────────────────────
  for (const repo of data.repos) {
    if (repo.archived) continue

    const repoNodeId = `role:${repo.fullName}` // reuse "role" type for repos
    const riskFactors: string[] = []
    let riskScore = 0

    if (!repo.branchProtection?.protected) {
      riskFactors.push("No branch protection")
      riskScore += 30
    } else {
      if (!repo.branchProtection.requiredReviews) {
        riskFactors.push("No required reviews")
        riskScore += 15
      }
      if (repo.branchProtection.allowForcePushes) {
        riskFactors.push("Force pushes allowed")
        riskScore += 20
      }
      if (repo.branchProtection.allowDeletions) {
        riskFactors.push("Branch deletions allowed")
        riskScore += 10
      }
    }

    if (!repo.private) {
      riskFactors.push("Public repository")
      riskScore += 10
    }

    if (repo.secretsCount > 0 && !repo.private) {
      riskFactors.push(`${repo.secretsCount} secrets in public repo`)
      riskScore += 40
    }

    addNode({
      id: repoNodeId,
      type: "role",
      label: repo.name,
      metadata: {
        fullName: repo.fullName,
        private: repo.private,
        defaultBranch: repo.defaultBranch,
        protected: repo.branchProtection?.protected ?? false,
        secretsCount: repo.secretsCount,
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // Edge: user -> repo (push access)
    edges.push({
      id: `edge:${userNodeId}:${repoNodeId}:push`,
      source: userNodeId,
      target: repoNodeId,
      type: "role-assignment",
      riskWeight: !repo.branchProtection?.protected ? 70 : 30,
    })

    // ── Runner nodes ─────────────────────────────────────────────
    for (const runner of repo.runners) {
      const runnerNodeId = `service-account:runner:${runner.id}`
      const runnerRiskFactors: string[] = []
      let runnerRiskScore = 0

      if (!repo.private) {
        runnerRiskFactors.push("Self-hosted runner on public repo")
        runnerRiskScore += 60
      } else {
        runnerRiskFactors.push("Self-hosted runner")
        runnerRiskScore += 20
      }

      addNode({
        id: runnerNodeId,
        type: "service-account",
        label: `Runner: ${runner.name}`,
        metadata: {
          runnerId: runner.id,
          os: runner.os,
          status: runner.status,
          repoName: repo.fullName,
        },
        riskScore: runnerRiskScore,
        riskFactors: runnerRiskFactors,
      })

      edges.push({
        id: `edge:${repoNodeId}:${runnerNodeId}:runner`,
        source: repoNodeId,
        target: runnerNodeId,
        type: "delegated",
        riskWeight: !repo.private ? 80 : 40,
      })
    }

    // ── Deploy key nodes (write only) ────────────────────────────
    for (const key of repo.deployKeys) {
      if (key.readOnly) continue
      const keyNodeId = `service-account:key:${key.id}`
      addNode({
        id: keyNodeId,
        type: "service-account",
        label: `Key: ${key.title}`,
        metadata: {
          keyId: key.id,
          readOnly: key.readOnly,
          createdAt: key.createdAt,
          repoName: repo.fullName,
        },
        riskScore: 30,
        riskFactors: ["Write deploy key"],
      })

      edges.push({
        id: `edge:${repoNodeId}:${keyNodeId}:deploy-key`,
        source: keyNodeId,
        target: repoNodeId,
        type: "delegated",
        riskWeight: 50,
      })
    }
  }

  // ── App installation nodes ────────────────────────────────────────
  for (const app of data.orgInstallations) {
    const appNodeId = `application:${app.appSlug}`
    const permissionCount = Object.keys(app.permissions).length
    const writePermissions = Object.entries(app.permissions).filter(([, v]) => v === "write" || v === "admin")
    const riskFactors: string[] = []
    let riskScore = 0

    if (app.repositorySelection === "all") {
      riskFactors.push("Access to all repos")
      riskScore += 40
    }

    if (writePermissions.length > 3) {
      riskFactors.push(`${writePermissions.length} write/admin permissions`)
      riskScore += 30
    }

    addNode({
      id: appNodeId,
      type: "application",
      label: app.appSlug,
      metadata: {
        appSlug: app.appSlug,
        permissionCount,
        repositorySelection: app.repositorySelection,
        writePermissions: writePermissions.map(([k]) => k),
      },
      riskScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    })

    // Connect app to each org it belongs to
    for (const org of orgNames) {
      const orgNodeId = `domain:${org}`
      edges.push({
        id: `edge:${appNodeId}:${orgNodeId}:installed`,
        source: appNodeId,
        target: orgNodeId,
        type: "delegated",
        riskWeight: app.repositorySelection === "all" ? 70 : 30,
      })
    }
  }

  // ── Attack chains ─────────────────────────────────────────────────

  // Chain 1 (Critical): Unprotected repos with push access
  const unprotectedRepos = data.repos.filter(
    (r) => !r.archived && !r.fork && !r.branchProtection?.protected,
  )
  if (unprotectedRepos.length > 0) {
    // Group by most critical first (public > private)
    const publicUnprotected = unprotectedRepos.filter((r) => !r.private)
    const privateUnprotected = unprotectedRepos.filter((r) => r.private)

    if (publicUnprotected.length > 0) {
      const repoNames = publicUnprotected.slice(0, 3).map((r) => r.fullName)
      const overflow = publicUnprotected.length > 3 ? ` (+${publicUnprotected.length - 3} more)` : ""
      highlightedPaths.push({
        id: "path:unprotected-public",
        label: `Unprotected Public Repos (${publicUnprotected.length})`,
        severity: "critical",
        nodeIds: [userNodeId, ...publicUnprotected.slice(0, 3).map((r) => `role:${r.fullName}`)],
        description: `${publicUnprotected.length} public repo(s) have no branch protection: ${repoNames.join(", ")}${overflow}. Anyone with push access can force-push to the default branch.`,
      })
    }

    if (privateUnprotected.length > 0) {
      const repoNames = privateUnprotected.slice(0, 3).map((r) => r.fullName)
      const overflow = privateUnprotected.length > 3 ? ` (+${privateUnprotected.length - 3} more)` : ""
      highlightedPaths.push({
        id: "path:unprotected-private",
        label: `Unprotected Private Repos (${privateUnprotected.length})`,
        severity: "high",
        nodeIds: [userNodeId, ...privateUnprotected.slice(0, 3).map((r) => `role:${r.fullName}`)],
        description: `${privateUnprotected.length} private repo(s) have no branch protection: ${repoNames.join(", ")}${overflow}. Collaborators can push directly to the default branch.`,
      })
    }
  }

  // Chain 2 (High): Self-hosted runners -> code execution
  const reposWithRunners = data.repos.filter((r) => r.runners.length > 0)
  for (const repo of reposWithRunners) {
    const severity = repo.private ? "medium" : "high"
    highlightedPaths.push({
      id: `path:runner:${repo.fullName}`,
      label: `Self-Hosted Runner: ${repo.name}`,
      severity,
      nodeIds: [
        `role:${repo.fullName}`,
        ...repo.runners.slice(0, 2).map((r) => `service-account:runner:${r.id}`),
      ],
      description: `${repo.runners.length} self-hosted runner(s) on ${repo.private ? "private" : "public"} repo ${repo.fullName}. ${!repo.private ? "Any user who can open a PR can execute code on the runner." : "Collaborators can execute code on the runner via Actions workflows."}`,
    })
  }

  // Chain 3 (High): Broad app installations
  const broadApps = data.orgInstallations.filter(
    (a) => a.repositorySelection === "all" && Object.entries(a.permissions).filter(([, v]) => v === "write" || v === "admin").length > 3,
  )
  for (const app of broadApps) {
    const orgNodeIds = [...orgNames].map((o) => `domain:${o}`)
    highlightedPaths.push({
      id: `path:broad-app:${app.appSlug}`,
      label: `Broad App: ${app.appSlug}`,
      severity: "high",
      nodeIds: [`application:${app.appSlug}`, ...orgNodeIds],
      description: `GitHub App "${app.appSlug}" is installed on all repositories with ${Object.entries(app.permissions).filter(([, v]) => v === "write" || v === "admin").length} write/admin permissions. Compromising this app grants broad access across the organization.`,
    })
  }

  // Chain 4 (Medium): Write deploy keys
  const reposWithWriteKeys = data.repos.filter(
    (r) => r.deployKeys.some((k) => !k.readOnly),
  )
  for (const repo of reposWithWriteKeys) {
    const writeKeys = repo.deployKeys.filter((k) => !k.readOnly)
    highlightedPaths.push({
      id: `path:deploy-key:${repo.fullName}`,
      label: `Write Deploy Key: ${repo.name}`,
      severity: "medium",
      nodeIds: [
        ...writeKeys.slice(0, 2).map((k) => `service-account:key:${k.id}`),
        `role:${repo.fullName}`,
      ],
      description: `${writeKeys.length} write deploy key(s) on ${repo.fullName}. These keys grant push access to the repository without user authentication.`,
    })
  }

  return { nodes, edges, highlightedPaths }
}
