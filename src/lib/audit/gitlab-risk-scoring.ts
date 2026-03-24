import type { RiskSeverity, RiskCategory } from "./risk-scoring"
import { severityFromScore, summarizeList } from "./risk-scoring"

// ── Input types (matching API response) ──────────────────────────────

export type GitLabAuditData = {
  user: {
    username: string
    isAdmin: boolean
    twoFactorEnabled: boolean
  }
  projects: Array<{
    id: number
    name: string
    pathWithNamespace: string
    visibility: string
    archived: boolean
    defaultBranch: string | null
    protectedBranches: Array<{
      name: string
      pushAccessLevels: Array<{ accessLevel: number }>
      mergeAccessLevels: Array<{ accessLevel: number }>
    }>
    variables: Array<{
      key: string
      masked: boolean
      protected: boolean
      variableType: string
    }>
    hooks: Array<{
      id: number
      url: string
      enableSslVerification: boolean
    }>
    deployTokens: Array<{
      id: number
      name: string
      scopes: string[]
      expiresAt: string | null
      active: boolean
    }>
    members: Array<{
      id: number
      username: string
      accessLevel: number
      state: string
    }>
  }>
  groupMembers: Array<{
    groupId: number
    groupName: string
    members: Array<{
      id: number
      username: string
      accessLevel: number
    }>
  }>
  runners: Array<{
    id: number
    description: string
    runnerType: string
    active: boolean
    isShared: boolean
    tagList: string[]
  }>
}

// ── Output types ────────────────────────────────────────────────────

export type GitLabRiskStats = {
  totalProjects: number
  unprotectedProjects: number
  unmaskedVariables: number
  nonSharedRunners: number
  expiredTokens: number
}

export type GitLabRiskAssessment = {
  aggregateScore: number
  severity: RiskSeverity
  categories: RiskCategory[]
  stats: GitLabRiskStats
}

// ── Write scopes for deploy tokens ──────────────────────────────────

const WRITE_SCOPES = new Set([
  "read_write",
  "write_repository",
  "write_registry",
  "write_package_registry",
])

function hasWriteScope(scopes: string[]): boolean {
  return scopes.some((s) => WRITE_SCOPES.has(s))
}

// ── Category 1: Branch Protection Gaps (25%) ────────────────────────

function computeBranchProtectionGaps(
  projects: GitLabAuditData["projects"]
): RiskCategory {
  const nonArchived = projects.filter((p) => !p.archived && p.defaultBranch)
  const total = nonArchived.length

  if (total === 0) {
    return {
      id: "branch-protection",
      label: "Branch Protection Gaps",
      severity: "low",
      score: 1,
      weight: 25,
      metric: "No active projects with default branches",
      details: [],
      unavailable: true,
    }
  }

  const unprotected = nonArchived.filter((p) => {
    const protectedNames = p.protectedBranches.map((b) => b.name)
    return !protectedNames.includes(p.defaultBranch!)
  })

  const pct = (unprotected.length / total) * 100
  let score: number
  if (pct > 50) score = 4
  else if (pct > 25) score = 3
  else if (pct > 10) score = 2
  else score = 1

  const details: string[] = []
  if (unprotected.length > 0) {
    details.push(
      summarizeList(
        unprotected,
        "Unprotected default branches",
        (p) => p.pathWithNamespace
      )
    )
  }

  return {
    id: "branch-protection",
    label: "Branch Protection Gaps",
    severity: severityFromScore(score),
    score,
    weight: 25,
    metric: `${unprotected.length} of ${total} projects (${Math.round(pct)}%) unprotected`,
    details,
  }
}

// ── Category 2: CI/CD Variable Exposure (20%) ───────────────────────

function computeVariableExposure(
  projects: GitLabAuditData["projects"]
): RiskCategory {
  const exposedVars: { project: string; key: string }[] = []

  for (const p of projects) {
    for (const v of p.variables) {
      if (!v.masked && !v.protected) {
        exposedVars.push({ project: p.pathWithNamespace, key: v.key })
      }
    }
  }

  const count = exposedVars.length
  let score: number
  if (count > 10) score = 4
  else if (count > 5) score = 3
  else if (count > 2) score = 2
  else score = 1

  const details: string[] = []
  if (exposedVars.length > 0) {
    details.push(
      summarizeList(
        exposedVars,
        "Unmasked & unprotected vars",
        (v) => `${v.project}/${v.key}`
      )
    )
  }

  return {
    id: "variable-exposure",
    label: "CI/CD Variable Exposure",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${count} unmasked & unprotected variable${count !== 1 ? "s" : ""}`,
    details,
  }
}

// ── Category 3: Access Control (20%) ────────────────────────────────

function computeAccessControl(
  projects: GitLabAuditData["projects"],
  groupMembers: GitLabAuditData["groupMembers"]
): RiskCategory {
  // Count owners (access_level 50) across all groups
  const ownerIds = new Set<number>()
  for (const g of groupMembers) {
    for (const m of g.members) {
      if (m.accessLevel >= 50) ownerIds.add(m.id)
    }
  }

  // Check projects with >3 maintainers (access_level >= 40)
  const projectsWithExcessMaintainers = projects.filter((p) => {
    const maintainers = p.members.filter((m) => m.accessLevel >= 40)
    return maintainers.length > 3
  })

  let score: number
  if (ownerIds.size > 5) score = 4
  else if (projectsWithExcessMaintainers.length > 3) score = 3
  else if (ownerIds.size > 2 || projectsWithExcessMaintainers.length > 0) score = 2
  else score = 1

  const details: string[] = []
  details.push(`${ownerIds.size} unique Owner-level user${ownerIds.size !== 1 ? "s" : ""} across groups`)
  if (projectsWithExcessMaintainers.length > 0) {
    details.push(
      summarizeList(
        projectsWithExcessMaintainers,
        "Projects with >3 Maintainers",
        (p) => p.pathWithNamespace
      )
    )
  }

  return {
    id: "access-control",
    label: "Access Control",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${ownerIds.size} Owner${ownerIds.size !== 1 ? "s" : ""}, ${projectsWithExcessMaintainers.length} over-privileged project${projectsWithExcessMaintainers.length !== 1 ? "s" : ""}`,
    details,
  }
}

// ── Category 4: Runner Security (15%) ───────────────────────────────

function computeRunnerSecurity(
  runners: GitLabAuditData["runners"]
): RiskCategory {
  const nonShared = runners.filter((r) => r.runnerType !== "instance_type")
  const count = nonShared.length

  let score: number
  if (count > 5) score = 4
  else if (count > 2) score = 3
  else if (count > 0) score = 2
  else score = 1

  const details: string[] = []
  if (nonShared.length > 0) {
    details.push(
      summarizeList(
        nonShared,
        "Non-shared runners",
        (r) => r.description || `Runner #${r.id}`
      )
    )
  }
  if (runners.length === 0) {
    details.push("No runners accessible with current token")
  }

  return {
    id: "runner-security",
    label: "Runner Security",
    severity: severityFromScore(score),
    score,
    weight: 15,
    metric: `${count} non-shared runner${count !== 1 ? "s" : ""} of ${runners.length} total`,
    details,
    unavailable: runners.length === 0,
  }
}

// ── Category 5: Deploy Token Sprawl (10%) ───────────────────────────

function computeDeployTokenSprawl(
  projects: GitLabAuditData["projects"]
): RiskCategory {
  const writeTokens: { project: string; name: string }[] = []
  let expiredActiveCount = 0

  for (const p of projects) {
    for (const t of p.deployTokens) {
      if (hasWriteScope(t.scopes)) {
        writeTokens.push({ project: p.pathWithNamespace, name: t.name })
      }
      if (t.expiresAt && t.active) {
        const expired = new Date(t.expiresAt) < new Date()
        if (expired) expiredActiveCount++
      }
    }
  }

  const riskCount = writeTokens.length + expiredActiveCount
  let score: number
  if (writeTokens.length > 5) score = 4
  else if (writeTokens.length > 2) score = 3
  else if (riskCount > 0) score = 2
  else score = 1

  const details: string[] = []
  if (writeTokens.length > 0) {
    details.push(
      summarizeList(
        writeTokens,
        "Tokens with write scopes",
        (t) => `${t.project}: ${t.name}`
      )
    )
  }
  if (expiredActiveCount > 0) {
    details.push(`${expiredActiveCount} expired but still active token${expiredActiveCount !== 1 ? "s" : ""}`)
  }

  return {
    id: "deploy-token-sprawl",
    label: "Deploy Token Sprawl",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${writeTokens.length} write token${writeTokens.length !== 1 ? "s" : ""}, ${expiredActiveCount} expired-active`,
    details,
  }
}

// ── Category 6: Webhook Security (10%) ──────────────────────────────

function computeWebhookSecurity(
  projects: GitLabAuditData["projects"]
): RiskCategory {
  const insecureHooks: { project: string; url: string }[] = []

  for (const p of projects) {
    for (const h of p.hooks) {
      if (!h.enableSslVerification) {
        insecureHooks.push({ project: p.pathWithNamespace, url: h.url })
      }
    }
  }

  const count = insecureHooks.length
  let score: number
  if (count > 3) score = 4
  else if (count >= 1) score = 3
  else score = 1

  const details: string[] = []
  if (insecureHooks.length > 0) {
    details.push(
      summarizeList(
        insecureHooks,
        "SSL verification disabled",
        (h) => `${h.project}: ${h.url}`
      )
    )
  }

  return {
    id: "webhook-security",
    label: "Webhook Security",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${count} webhook${count !== 1 ? "s" : ""} without SSL verification`,
    details,
  }
}

// ── Main assessment function ────────────────────────────────────────

export function computeGitLabRiskAssessment(
  data: GitLabAuditData
): GitLabRiskAssessment {
  const nonArchived = data.projects.filter((p) => !p.archived && p.defaultBranch)
  const unprotected = nonArchived.filter((p) => {
    const protectedNames = p.protectedBranches.map((b) => b.name)
    return !protectedNames.includes(p.defaultBranch!)
  })

  let unmaskedVarCount = 0
  let expiredTokenCount = 0
  for (const p of data.projects) {
    for (const v of p.variables) {
      if (!v.masked && !v.protected) unmaskedVarCount++
    }
    for (const t of p.deployTokens) {
      if (t.expiresAt && t.active && new Date(t.expiresAt) < new Date()) {
        expiredTokenCount++
      }
    }
  }

  const nonSharedRunners = data.runners.filter((r) => r.runnerType !== "instance_type")

  const stats: GitLabRiskStats = {
    totalProjects: data.projects.length,
    unprotectedProjects: unprotected.length,
    unmaskedVariables: unmaskedVarCount,
    nonSharedRunners: nonSharedRunners.length,
    expiredTokens: expiredTokenCount,
  }

  const categories: RiskCategory[] = [
    computeBranchProtectionGaps(data.projects),
    computeVariableExposure(data.projects),
    computeAccessControl(data.projects, data.groupMembers),
    computeRunnerSecurity(data.runners),
    computeDeployTokenSprawl(data.projects),
    computeWebhookSecurity(data.projects),
  ]

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0)
  const weightedSum = categories.reduce((sum, c) => sum + c.score * c.weight, 0)
  const aggregateScore = totalWeight > 0 ? weightedSum / totalWeight : 1

  return {
    aggregateScore,
    severity: severityFromScore(Math.round(aggregateScore)),
    categories,
    stats,
  }
}
