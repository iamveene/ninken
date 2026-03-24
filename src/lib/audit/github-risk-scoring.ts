import { type RiskSeverity, type RiskCategory, severityFromScore, summarizeList } from "./risk-scoring"

// ── Input types (matching API response) ──────────────────────────────

export type GitHubAuditRepo = {
  name: string
  fullName: string
  private: boolean
  fork: boolean
  archived: boolean
  defaultBranch: string
  branchProtection: {
    protected: boolean
    requiredReviews: boolean
    requiredStatusChecks: boolean
    enforceAdmins: boolean
    allowForcePushes: boolean
    allowDeletions: boolean
  } | null
  webhooks: Array<{ id: number; url: string; events: string[]; active: boolean; insecureSsl: boolean }>
  deployKeys: Array<{ id: number; title: string; readOnly: boolean; createdAt: string }>
  runners: Array<{ id: number; name: string; os: string; status: string }>
  secretsCount: number
}

export type GitHubAuditData = {
  user: { login: string; twoFactorAuthentication: boolean | null }
  repos: GitHubAuditRepo[]
  orgMembers: Array<{ login: string; role: string; org: string }>
  orgInstallations: Array<{ appSlug: string; permissions: Record<string, string>; repositorySelection: string }>
  skippedRepos?: number
  errors?: string[]
}

// ── Output types ────────────────────────────────────────────────────

export type GitHubRiskStats = {
  totalRepos: number
  unprotectedRepos: number
  selfHostedRunners: number
  writeDeployKeys: number
  insecureWebhooks: number
}

export type GitHubRiskAssessment = {
  aggregateScore: number
  severity: RiskSeverity
  categories: RiskCategory[]
  stats: GitHubRiskStats
}

// ── Category 1: Branch Protection Gaps (25%) ────────────────────────

function computeBranchProtectionGaps(repos: GitHubAuditRepo[]): RiskCategory {
  const nonArchived = repos.filter((r) => !r.archived && !r.fork)
  const total = nonArchived.length

  if (total === 0) {
    return {
      id: "branch-protection",
      label: "Branch Protection Gaps",
      severity: "low",
      score: 1,
      weight: 25,
      metric: "No repos to assess",
      details: [],
      unavailable: true,
    }
  }

  const unprotected = nonArchived.filter(
    (r) => !r.branchProtection?.protected,
  )
  const pct = (unprotected.length / total) * 100

  let score: number
  if (pct > 50) score = 4
  else if (pct > 25) score = 3
  else if (pct > 10) score = 2
  else score = 1

  const details: string[] = []
  if (unprotected.length > 0) {
    details.push(summarizeList(unprotected, "Unprotected", (r) => r.fullName))
  }

  // Check for weak protections (protected but missing key controls)
  const weaklyProtected = nonArchived.filter(
    (r) =>
      r.branchProtection?.protected &&
      (!r.branchProtection.requiredReviews || r.branchProtection.allowForcePushes),
  )
  if (weaklyProtected.length > 0) {
    details.push(`${weaklyProtected.length} repo(s) with weak protection (no required reviews or force push allowed)`)
  }

  return {
    id: "branch-protection",
    label: "Branch Protection Gaps",
    severity: severityFromScore(score),
    score,
    weight: 25,
    metric: `${unprotected.length} of ${total} repos (${Math.round(pct)}%) unprotected`,
    details,
  }
}

// ── Category 2: Secret Exposure (20%) ───────────────────────────────

function computeSecretExposure(repos: GitHubAuditRepo[]): RiskCategory {
  const publicRepos = repos.filter((r) => !r.private && !r.archived)
  const publicWithSecrets = publicRepos.filter((r) => r.secretsCount > 0)
  const totalSecrets = repos.reduce((sum, r) => sum + r.secretsCount, 0)

  let score: number
  if (publicWithSecrets.length > 0) score = 4
  else if (totalSecrets > 20) score = 3
  else if (totalSecrets > 5) score = 2
  else score = 1

  const details: string[] = []
  if (publicWithSecrets.length > 0) {
    details.push(
      summarizeList(publicWithSecrets, "Public repos with secrets", (r) => `${r.fullName} (${r.secretsCount})`),
    )
  }
  if (totalSecrets > 0) {
    details.push(`${totalSecrets} total Actions secret(s) across all repos`)
  }

  return {
    id: "secret-exposure",
    label: "Secret Exposure",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: publicWithSecrets.length > 0
      ? `${publicWithSecrets.length} public repo(s) with secrets`
      : `${totalSecrets} total secrets`,
    details,
  }
}

// ── Category 3: Access Control (20%) ────────────────────────────────

function computeAccessControl(
  orgMembers: GitHubAuditData["orgMembers"],
): RiskCategory {
  const owners = orgMembers.filter((m) => m.role === "admin")
  const ownerCount = owners.length

  if (orgMembers.length === 0) {
    return {
      id: "access-control",
      label: "Access Control",
      severity: "low",
      score: 1,
      weight: 20,
      metric: "No org membership data",
      details: ["No organizations accessible or no members enumerated"],
      unavailable: true,
    }
  }

  let score: number
  if (ownerCount > 5) score = 4
  else if (ownerCount > 3) score = 3
  else if (ownerCount > 1) score = 2
  else score = 1

  const details: string[] = []
  if (owners.length > 0) {
    details.push(summarizeList(owners, "Org owners", (o) => `${o.login} (${o.org})`))
  }

  return {
    id: "access-control",
    label: "Access Control",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${ownerCount} org owner${ownerCount !== 1 ? "s" : ""} across ${new Set(orgMembers.map((m) => m.org)).size} org(s)`,
    details,
  }
}

// ── Category 4: Actions Security (15%) ──────────────────────────────

function computeActionsSecurity(repos: GitHubAuditRepo[]): RiskCategory {
  const allRunners = repos.flatMap((r) =>
    r.runners.map((runner) => ({ ...runner, repoName: r.fullName, repoPrivate: r.private })),
  )
  const publicRepoRunners = allRunners.filter((r) => !r.repoPrivate)
  const privateRepoRunners = allRunners.filter((r) => r.repoPrivate)

  let score: number
  if (publicRepoRunners.length > 0) score = 4
  else if (privateRepoRunners.length > 0) score = 3
  else score = 1

  const details: string[] = []
  if (publicRepoRunners.length > 0) {
    details.push(`${publicRepoRunners.length} self-hosted runner(s) on public repos (code execution risk)`)
  }
  if (privateRepoRunners.length > 0) {
    details.push(`${privateRepoRunners.length} self-hosted runner(s) on private repos`)
  }

  return {
    id: "actions-security",
    label: "Actions Security",
    severity: severityFromScore(score),
    score,
    weight: 15,
    metric: `${allRunners.length} self-hosted runner${allRunners.length !== 1 ? "s" : ""}`,
    details,
  }
}

// ── Category 5: Deploy Key Sprawl (10%) ─────────────────────────────

function computeDeployKeySprawl(repos: GitHubAuditRepo[]): RiskCategory {
  const allKeys = repos.flatMap((r) =>
    r.deployKeys.map((k) => ({ ...k, repoName: r.fullName })),
  )
  const writeKeys = allKeys.filter((k) => !k.readOnly)

  let score: number
  if (writeKeys.length > 10) score = 4
  else if (writeKeys.length > 5) score = 3
  else if (writeKeys.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (writeKeys.length > 0) {
    details.push(
      summarizeList(writeKeys, "Write deploy keys", (k) => `${k.title} (${k.repoName})`),
    )
  }
  if (allKeys.length > writeKeys.length) {
    details.push(`${allKeys.length - writeKeys.length} read-only deploy key(s)`)
  }

  return {
    id: "deploy-key-sprawl",
    label: "Deploy Key Sprawl",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${writeKeys.length} write deploy key${writeKeys.length !== 1 ? "s" : ""} across ${new Set(allKeys.map((k) => k.repoName)).size} repo(s)`,
    details,
  }
}

// ── Category 6: Webhook Misconfiguration (10%) ──────────────────────

function computeWebhookMisconfiguration(repos: GitHubAuditRepo[]): RiskCategory {
  const allWebhooks = repos.flatMap((r) =>
    r.webhooks.map((w) => ({ ...w, repoName: r.fullName })),
  )
  const httpWebhooks = allWebhooks.filter(
    (w) => w.active && w.url && !w.url.startsWith("https://"),
  )
  const insecureSslWebhooks = allWebhooks.filter((w) => w.active && w.insecureSsl)
  const wildcardWebhooks = allWebhooks.filter(
    (w) => w.active && w.events.includes("*"),
  )

  let score: number
  if (httpWebhooks.length > 0) score = 4
  else if (wildcardWebhooks.length > 0) score = 3
  else if (insecureSslWebhooks.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (httpWebhooks.length > 0) {
    details.push(`${httpWebhooks.length} webhook(s) using plain HTTP (not HTTPS)`)
  }
  if (wildcardWebhooks.length > 0) {
    details.push(`${wildcardWebhooks.length} webhook(s) subscribed to all events (wildcard)`)
  }
  if (insecureSslWebhooks.length > 0) {
    details.push(`${insecureSslWebhooks.length} webhook(s) with SSL verification disabled`)
  }

  return {
    id: "webhook-misconfiguration",
    label: "Webhook Misconfiguration",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${httpWebhooks.length + wildcardWebhooks.length + insecureSslWebhooks.length} misconfigured webhook${httpWebhooks.length + wildcardWebhooks.length + insecureSslWebhooks.length !== 1 ? "s" : ""}`,
    details,
  }
}

// ── Main assessment function ────────────────────────────────────────

export function computeGitHubRiskAssessment(
  data: GitHubAuditData,
): GitHubRiskAssessment {
  const nonArchived = data.repos.filter((r) => !r.archived && !r.fork)
  const unprotected = nonArchived.filter((r) => !r.branchProtection?.protected)
  const allRunners = data.repos.flatMap((r) => r.runners)
  const allDeployKeys = data.repos.flatMap((r) => r.deployKeys)
  const writeKeys = allDeployKeys.filter((k) => !k.readOnly)
  const allWebhooks = data.repos.flatMap((r) => r.webhooks)
  const insecureWebhooks = allWebhooks.filter(
    (w) =>
      w.active &&
      (
        (w.url && !w.url.startsWith("https://")) ||
        w.insecureSsl ||
        w.events.includes("*")
      ),
  )

  const stats: GitHubRiskStats = {
    totalRepos: data.repos.length,
    unprotectedRepos: unprotected.length,
    selfHostedRunners: allRunners.length,
    writeDeployKeys: writeKeys.length,
    insecureWebhooks: insecureWebhooks.length,
  }

  const categories: RiskCategory[] = [
    computeBranchProtectionGaps(data.repos),
    computeSecretExposure(data.repos),
    computeAccessControl(data.orgMembers),
    computeActionsSecurity(data.repos),
    computeDeployKeySprawl(data.repos),
    computeWebhookMisconfiguration(data.repos),
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
