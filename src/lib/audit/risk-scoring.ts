import type { AuditUser, AuditGroup, AuditRole, AuditDelegation, AuditApp, AuditOverview } from "@/hooks/use-audit"

export type RiskSeverity = "critical" | "high" | "medium" | "low"

export type RiskCategory = {
  id: string
  label: string
  severity: RiskSeverity
  score: number          // 1-4
  weight: number         // percentage weight
  metric: string         // human-readable, e.g., "12 users (34%)"
  details: string[]      // specific findings
  unavailable?: boolean  // true when data couldn't be loaded
}

export type RiskStats = {
  totalUsers: number
  activeUsers: number
  usersWithout2FA: number
  superAdminCount: number
  delegationCount: number
  externalGroups: number
  staleUserCount: number
  totalGroups: number
}

export type RiskAssessment = {
  aggregateScore: number
  severity: RiskSeverity
  categories: RiskCategory[]
  stats: RiskStats
}

const SENSITIVE_SCOPE_PATTERNS = [
  "admin",
  "gmail",
  "drive",
  "calendar",
  "contacts",
  "directory",
  "groups",
  "apps.order",
  "cloud-platform",
]

function severityFromScore(score: number): RiskSeverity {
  if (score >= 4) return "critical"
  if (score >= 3) return "high"
  if (score >= 2) return "medium"
  return "low"
}

function isStaleUser(user: AuditUser): boolean {
  if (!user.lastLoginTime) return true
  const loginDate = new Date(user.lastLoginTime)
  // Google returns epoch 0 for never-logged-in users
  if (loginDate.getTime() === 0) return true
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  return loginDate < ninetyDaysAgo
}

/** Format "label: a, b, c (+N more)" from an array, showing up to `max` items. */
function summarizeList<T>(items: T[], label: string, fmt: (item: T) => string, max = 3): string {
  const shown = items.slice(0, max).map(fmt)
  const overflow = items.length > max ? ` (+${items.length - max} more)` : ""
  return `${label}: ${shown.join(", ")}${overflow}`
}

/** Pre-computed derived user lists, shared across category functions to avoid redundant filtering. */
type DerivedUsers = {
  active: AuditUser[]
  without2FA: AuditUser[]
  superAdmins: AuditUser[]
  stale: AuditUser[]
}

function deriveUsers(users: AuditUser[]): DerivedUsers {
  const active = users.filter((u) => !u.suspended)
  return {
    active,
    without2FA: active.filter((u) => !u.isEnrolledIn2Sv),
    superAdmins: active.filter((u) => u.isAdmin),
    stale: active.filter(isStaleUser),
  }
}

function compute2FACoverage(derived: DerivedUsers): RiskCategory {
  const total = derived.active.length

  if (total === 0) {
    return {
      id: "2fa-coverage",
      label: "2FA Coverage Gap",
      severity: "low",
      score: 1,
      weight: 25,
      metric: "No active users",
      details: [],
      unavailable: true,
    }
  }

  const pct = (derived.without2FA.length / total) * 100
  let score: number
  if (pct > 50) score = 4
  else if (pct > 25) score = 3
  else if (pct > 10) score = 2
  else score = 1

  const details: string[] = []
  if (derived.without2FA.length > 0) {
    details.push(summarizeList(derived.without2FA, "Users without 2FA", (u) => u.primaryEmail))
  }

  return {
    id: "2fa-coverage",
    label: "2FA Coverage Gap",
    severity: severityFromScore(score),
    score,
    weight: 25,
    metric: `${derived.without2FA.length} users (${Math.round(pct)}%)`,
    details,
  }
}

function computeAdminConcentration(derived: DerivedUsers, roles: AuditRole[]): RiskCategory {
  const superAdminRoles = roles.filter((r) => r.isSuperAdminRole)
  const roleAssignees = new Set<string>()
  for (const role of superAdminRoles) {
    for (const a of role.assignees) {
      roleAssignees.add(a.assignedTo)
    }
  }

  const count = Math.max(derived.superAdmins.length, roleAssignees.size)

  let score: number
  if (count > 5) score = 4
  else if (count > 3) score = 3
  else if (count > 1) score = 2
  else score = 1

  const details: string[] = []
  if (derived.superAdmins.length > 0) {
    details.push(summarizeList(derived.superAdmins, "Super admins", (u) => u.primaryEmail))
  }

  return {
    id: "admin-concentration",
    label: "Admin Concentration",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${count} super admin${count !== 1 ? "s" : ""}`,
    details,
  }
}

function computeDomainWideDelegation(delegations: AuditDelegation[]): RiskCategory {
  const count = delegations.length

  let score: number
  if (count > 3) score = 4
  else if (count > 1) score = 3
  else if (count === 1) score = 2
  else score = 1

  const details: string[] = []
  if (count > 0) {
    const shown = delegations.slice(0, 3).map((d) => `${d.serviceAccountId} (${d.scopes.length} scopes)`)
    details.push(...shown)
    if (count > 3) details.push(`+${count - 3} more service accounts`)
  }

  return {
    id: "domain-wide-delegation",
    label: "Domain-Wide Delegation",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${count} service account${count !== 1 ? "s" : ""} with DWD`,
    details,
  }
}

function computeExternalExposure(groups: AuditGroup[], overview: AuditOverview | null): RiskCategory {
  // allowExternalMembers lives in groups-settings, not in AuditGroup
  const totalGroups = groups.length

  if (totalGroups === 0 && !overview?.directory.accessible) {
    return {
      id: "external-exposure",
      label: "External Exposure",
      severity: "low",
      score: 1,
      weight: 15,
      metric: "Data unavailable",
      details: ["Groups data not accessible with current token"],
      unavailable: true,
    }
  }

  return {
    id: "external-exposure",
    label: "External Exposure",
    severity: "low",
    score: 1,
    weight: 15,
    metric: `${totalGroups} groups enumerated`,
    details: [
      "External member data requires Groups Settings audit",
      `${totalGroups} total groups found`,
    ],
    unavailable: true,
  }
}

function computeStaleAccounts(derived: DerivedUsers): RiskCategory {
  const total = derived.active.length

  if (total === 0) {
    return {
      id: "stale-accounts",
      label: "Stale Accounts",
      severity: "low",
      score: 1,
      weight: 10,
      metric: "No active users",
      details: [],
      unavailable: true,
    }
  }

  const pct = (derived.stale.length / total) * 100
  let score: number
  if (pct > 30) score = 4
  else if (pct > 15) score = 3
  else if (pct > 5) score = 2
  else score = 1

  const details: string[] = []
  if (derived.stale.length > 0) {
    details.push(summarizeList(derived.stale, "Stale", (u) => u.primaryEmail))
  }

  return {
    id: "stale-accounts",
    label: "Stale Accounts",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${derived.stale.length} users (${Math.round(pct)}%)`,
    details,
  }
}

function computeSensitiveScopes(apps: AuditApp[]): RiskCategory {
  const sensitiveApps: { app: string; count: number }[] = []

  for (const app of apps) {
    const count = app.scopes.filter((scope) => {
      const lower = scope.toLowerCase()
      return SENSITIVE_SCOPE_PATTERNS.some((p) => lower.includes(p))
    }).length
    if (count > 0) {
      sensitiveApps.push({ app: app.displayText, count })
    }
  }

  const totalSensitive = sensitiveApps.reduce((sum, a) => sum + a.count, 0)

  let score: number
  if (totalSensitive > 20) score = 4
  else if (totalSensitive > 10) score = 3
  else if (totalSensitive > 3) score = 2
  else score = 1

  const details: string[] = []
  if (sensitiveApps.length > 0) {
    details.push(summarizeList(sensitiveApps, "Apps", (a) => `${a.app} (${a.count} sensitive)`))
  }

  return {
    id: "sensitive-scopes",
    label: "Sensitive Scope Grants",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${totalSensitive} sensitive scope${totalSensitive !== 1 ? "s" : ""} across ${sensitiveApps.length} app${sensitiveApps.length !== 1 ? "s" : ""}`,
    details,
  }
}

export function computeRiskAssessment(
  users: AuditUser[],
  roles: AuditRole[],
  delegations: AuditDelegation[],
  groups: AuditGroup[],
  apps: AuditApp[],
  overview: AuditOverview | null,
): RiskAssessment {
  const derived = deriveUsers(users)

  const stats: RiskStats = {
    totalUsers: users.length,
    activeUsers: derived.active.length,
    usersWithout2FA: derived.without2FA.length,
    superAdminCount: derived.superAdmins.length,
    delegationCount: delegations.length,
    externalGroups: 0,
    staleUserCount: derived.stale.length,
    totalGroups: groups.length,
  }

  const categories: RiskCategory[] = [
    compute2FACoverage(derived),
    computeAdminConcentration(derived, roles),
    computeDomainWideDelegation(delegations),
    computeExternalExposure(groups, overview),
    computeStaleAccounts(derived),
    computeSensitiveScopes(apps),
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
