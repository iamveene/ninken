import type { RiskSeverity, RiskCategory } from "./risk-scoring"

// ── Local helpers (duplicated from risk-scoring.ts — will refactor later) ──

function severityFromScore(score: number): RiskSeverity {
  if (score >= 4) return "critical"
  if (score >= 3) return "high"
  if (score >= 2) return "medium"
  return "low"
}

function summarizeList<T>(items: T[], label: string, fmt: (item: T) => string, max = 3): string {
  const shown = items.slice(0, max).map(fmt)
  const overflow = items.length > max ? ` (+${items.length - max} more)` : ""
  return `${label}: ${shown.join(", ")}${overflow}`
}

// ── Input types ────────────────────────────────────────────────────────

/** From use-m365-audit.ts */
type AuthMethodUser = {
  id: string
  displayName: string
  userPrincipalName: string
  methods: { odataType: string; id: string }[]
}

/** From use-entra.ts */
type EntraRole = {
  id: string
  displayName: string
  description?: string
  isBuiltIn?: boolean
  members: { id: string; displayName: string; userPrincipalName?: string }[]
}

/** From use-entra.ts */
type EntraGroup = {
  id: string
  displayName: string
  groupTypes: string[]
  securityEnabled: boolean
}

/** From use-m365-audit.ts */
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

type CrossTenantDefaultPolicy = {
  inboundTrust?: { isMfaAccepted?: boolean }
}

type RiskyUser = {
  id: string
  userDisplayName: string | null
  userPrincipalName: string | null
  riskLevel: string
  riskState: string
}

type RiskDetection = {
  id: string
  riskEventType: string
  riskLevel: string
  userDisplayName: string | null
  userPrincipalName: string | null
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

// ── Output types ───────────────────────────────────────────────────────

export type M365RiskStats = {
  totalUsers: number
  activeUsers: number
  usersWithWeakMFA: number
  globalAdminCount: number
  privilegedRoleCount: number
  enabledCAPolicies: number
  totalCAPolicies: number
  crossTenantPartners: number
  riskyUserCount: number
  overPermissionedApps: number
  totalGroups: number
}

export type M365RiskAssessment = {
  aggregateScore: number
  severity: RiskSeverity
  categories: RiskCategory[]
  stats: M365RiskStats
}

// ── MFA classification helpers ─────────────────────────────────────────

/** OData types that count as strong MFA methods */
const STRONG_MFA_TYPES = new Set([
  "#microsoft.graph.fido2AuthenticationMethod",
  "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod",
  "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod",
  "#microsoft.graph.softwareOathAuthenticationMethod",
])

/** OData types that count as weak/legacy MFA */
const WEAK_MFA_TYPES = new Set([
  "#microsoft.graph.phoneAuthenticationMethod",
  "#microsoft.graph.emailAuthenticationMethod",
])

/** Password-only type */
const PASSWORD_TYPE = "#microsoft.graph.passwordAuthenticationMethod"

function hasStrongMFA(methods: { odataType: string }[]): boolean {
  return methods.some((m) => STRONG_MFA_TYPES.has(m.odataType))
}

function isWeakMFAUser(methods: { odataType: string }[]): boolean {
  if (hasStrongMFA(methods)) return false
  // Password-only or phone-only are weak
  const nonPassword = methods.filter((m) => m.odataType !== PASSWORD_TYPE)
  if (nonPassword.length === 0) return true // password only
  return nonPassword.every((m) => WEAK_MFA_TYPES.has(m.odataType))
}

// ── Dangerous permission scopes ────────────────────────────────────────

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

function hasDangerousPermissions(sp: ServicePrincipalAuditEntry): boolean {
  const allScopes = sp.delegatedPermissions.map((p) => p.scope)
  return allScopes.some((s) => DANGEROUS_SCOPES.has(s))
}

// ── Category 1: MFA Coverage Gap (25%) ─────────────────────────────────

function computeMFACoverageGap(users: AuthMethodUser[]): RiskCategory {
  const total = users.length

  if (total === 0) {
    return {
      id: "mfa-coverage",
      label: "MFA Coverage Gap",
      severity: "low",
      score: 1,
      weight: 25,
      metric: "No users to assess",
      details: [],
      unavailable: true,
    }
  }

  const weakUsers = users.filter((u) => isWeakMFAUser(u.methods))
  const pct = (weakUsers.length / total) * 100

  let score: number
  if (pct > 50) score = 4
  else if (pct > 25) score = 3
  else if (pct > 10) score = 2
  else score = 1

  const details: string[] = []
  if (weakUsers.length > 0) {
    details.push(summarizeList(weakUsers, "Weak/no MFA", (u) => u.userPrincipalName))
  }

  return {
    id: "mfa-coverage",
    label: "MFA Coverage Gap",
    severity: severityFromScore(score),
    score,
    weight: 25,
    metric: `${weakUsers.length} users (${Math.round(pct)}%) with weak/no MFA`,
    details,
  }
}

// ── Category 2: Privileged Role Concentration (20%) ────────────────────

function computePrivilegedRoleConcentration(roles: EntraRole[]): RiskCategory {
  const globalAdminRole = roles.find((r) => r.displayName === "Global Administrator")
  const globalAdminCount = globalAdminRole?.members.length ?? 0

  const privilegedRoles = roles.filter((r) =>
    r.members.length > 0 && (
      r.displayName === "Global Administrator" ||
      r.displayName === "Privileged Role Administrator" ||
      r.displayName === "Exchange Administrator" ||
      r.displayName === "SharePoint Administrator" ||
      r.displayName === "User Administrator" ||
      r.displayName === "Security Administrator"
    ),
  )

  let score: number
  if (globalAdminCount > 5) score = 4
  else if (globalAdminCount > 3) score = 3
  else if (globalAdminCount > 1) score = 2
  else score = 1

  const details: string[] = []
  if (globalAdminRole && globalAdminRole.members.length > 0) {
    details.push(
      summarizeList(
        globalAdminRole.members,
        "Global Admins",
        (m) => m.userPrincipalName || m.displayName,
      ),
    )
  }
  for (const role of privilegedRoles) {
    if (role.displayName !== "Global Administrator") {
      details.push(`${role.displayName}: ${role.members.length} member${role.members.length !== 1 ? "s" : ""}`)
    }
  }

  return {
    id: "privileged-roles",
    label: "Privileged Role Concentration",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${globalAdminCount} Global Admin${globalAdminCount !== 1 ? "s" : ""}, ${privilegedRoles.length} privileged role${privilegedRoles.length !== 1 ? "s" : ""} with members`,
    details,
  }
}

// ── Category 3: Conditional Access Gaps (20%) ──────────────────────────

function computeConditionalAccessGaps(policies: ConditionalAccessPolicy[]): RiskCategory {
  const enabledPolicies = policies.filter((p) => p.state === "enabled" || p.state === "enabledForReportingButNotEnforced")
  const enforcedPolicies = policies.filter((p) => p.state === "enabled")

  // Check for MFA-for-all policy: includeUsers has "All" and grantControls has "mfa"
  const hasMfaForAll = enforcedPolicies.some(
    (p) =>
      p.conditions.users?.includeUsers?.includes("All") &&
      p.grantControls?.builtInControls?.includes("mfa"),
  )

  // Check for admin role protection: policy targeting admin roles with MFA
  const hasAdminProtection = enforcedPolicies.some(
    (p) =>
      (p.conditions.users?.includeRoles?.length ?? 0) > 0 &&
      p.grantControls?.builtInControls?.includes("mfa"),
  )

  let score: number
  if (enforcedPolicies.length === 0) score = 4
  else if (!hasMfaForAll) score = 3
  else if (!hasAdminProtection) score = 2
  else score = 1

  const details: string[] = []
  if (enforcedPolicies.length === 0) {
    details.push("No enforced Conditional Access policies")
  } else {
    details.push(`${enforcedPolicies.length} enforced, ${enabledPolicies.length - enforcedPolicies.length} report-only`)
    if (!hasMfaForAll) details.push("No policy enforcing MFA for all users")
    if (!hasAdminProtection) details.push("No policy protecting admin roles with MFA")
  }

  return {
    id: "conditional-access",
    label: "Conditional Access Gaps",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${enforcedPolicies.length} enforced of ${policies.length} total`,
    details,
  }
}

// ── Category 4: External Exposure (15%) ────────────────────────────────

function computeExternalExposure(
  partners: CrossTenantPartner[],
  defaultPolicy: CrossTenantDefaultPolicy | null,
): RiskCategory {
  const partnersWithMfaTrust = partners.filter((p) => p.inboundTrust?.isMfaAccepted)
  const defaultTrustsMfa = defaultPolicy?.inboundTrust?.isMfaAccepted === true
  const effectiveTrustCount = partnersWithMfaTrust.length + (defaultTrustsMfa ? 1 : 0)

  let score: number
  if (effectiveTrustCount > 5) score = 4
  else if (effectiveTrustCount > 2) score = 3
  else if (effectiveTrustCount > 0) score = 2
  else score = 1

  const details: string[] = []
  if (defaultTrustsMfa) {
    details.push("Default cross-tenant policy accepts external MFA")
  }
  if (partnersWithMfaTrust.length > 0) {
    details.push(
      summarizeList(
        partnersWithMfaTrust,
        "Partners trusting external MFA",
        (p) => p.tenantId,
      ),
    )
  }
  if (partners.length > 0) {
    details.push(`${partners.length} total cross-tenant partner${partners.length !== 1 ? "s" : ""} configured`)
  }

  return {
    id: "external-exposure",
    label: "External Exposure",
    severity: severityFromScore(score),
    score,
    weight: 15,
    metric: `${effectiveTrustCount} trust${effectiveTrustCount !== 1 ? "s" : ""} accepting external MFA`,
    details,
  }
}

// ── Category 5: Risky Users/Sign-Ins (10%) ─────────────────────────────

function computeRiskyUsers(
  riskyUsers: RiskyUser[],
  riskDetections: RiskDetection[],
): RiskCategory {
  const highRiskUsers = riskyUsers.filter((u) => u.riskLevel === "high")
  const mediumRiskUsers = riskyUsers.filter((u) => u.riskLevel === "medium")
  const highRiskDetections = riskDetections.filter((d) => d.riskLevel === "high")

  let score: number
  if (highRiskUsers.length > 0 || highRiskDetections.length > 0) score = 4
  else if (mediumRiskUsers.length > 3) score = 3
  else if (riskDetections.length > 0 || riskyUsers.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (highRiskUsers.length > 0) {
    details.push(
      summarizeList(highRiskUsers, "High-risk users", (u) => u.userPrincipalName ?? u.id),
    )
  }
  if (mediumRiskUsers.length > 0) {
    details.push(`${mediumRiskUsers.length} medium-risk user${mediumRiskUsers.length !== 1 ? "s" : ""}`)
  }
  if (riskDetections.length > 0) {
    details.push(`${riskDetections.length} risk detection${riskDetections.length !== 1 ? "s" : ""} active`)
  }

  return {
    id: "risky-users",
    label: "Risky Users/Sign-Ins",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${riskyUsers.length} risky user${riskyUsers.length !== 1 ? "s" : ""}, ${riskDetections.length} detection${riskDetections.length !== 1 ? "s" : ""}`,
    details,
  }
}

// ── Category 6: App Over-Permissioning (10%) ───────────────────────────

function computeAppOverPermissioning(
  servicePrincipals: ServicePrincipalAuditEntry[],
): RiskCategory {
  const overPermissioned = servicePrincipals.filter(hasDangerousPermissions)
  const count = overPermissioned.length

  let score: number
  if (count > 10) score = 4
  else if (count > 5) score = 3
  else if (count > 2) score = 2
  else score = 1

  const details: string[] = []
  if (overPermissioned.length > 0) {
    details.push(
      summarizeList(
        overPermissioned,
        "Over-permissioned apps",
        (sp) => {
          const dangerousScopes = sp.delegatedPermissions
            .map((p) => p.scope)
            .filter((s) => DANGEROUS_SCOPES.has(s))
          return `${sp.displayName} (${dangerousScopes.join(", ")})`
        },
      ),
    )
  }

  return {
    id: "app-over-permissioning",
    label: "App Over-Permissioning",
    severity: severityFromScore(score),
    score,
    weight: 10,
    metric: `${count} app${count !== 1 ? "s" : ""} with dangerous permissions`,
    details,
  }
}

// ── Main assessment function ───────────────────────────────────────────

export function computeM365RiskAssessment(
  authMethodUsers: AuthMethodUser[],
  roles: EntraRole[],
  policies: ConditionalAccessPolicy[],
  partners: CrossTenantPartner[],
  defaultPolicy: CrossTenantDefaultPolicy | null,
  groups: EntraGroup[],
  riskyUsers: RiskyUser[],
  riskDetections: RiskDetection[],
  servicePrincipals: ServicePrincipalAuditEntry[],
): M365RiskAssessment {
  const weakMfaUsers = authMethodUsers.filter((u) => isWeakMFAUser(u.methods))
  const globalAdminRole = roles.find((r) => r.displayName === "Global Administrator")
  const enabledPolicies = policies.filter((p) => p.state === "enabled")
  const overPermissioned = servicePrincipals.filter(hasDangerousPermissions)

  const stats: M365RiskStats = {
    totalUsers: authMethodUsers.length,
    activeUsers: authMethodUsers.length,
    usersWithWeakMFA: weakMfaUsers.length,
    globalAdminCount: globalAdminRole?.members.length ?? 0,
    privilegedRoleCount: roles.filter((r) => r.members.length > 0).length,
    enabledCAPolicies: enabledPolicies.length,
    totalCAPolicies: policies.length,
    crossTenantPartners: partners.length,
    riskyUserCount: riskyUsers.length,
    overPermissionedApps: overPermissioned.length,
    totalGroups: groups.length,
  }

  const categories: RiskCategory[] = [
    computeMFACoverageGap(authMethodUsers),
    computePrivilegedRoleConcentration(roles),
    computeConditionalAccessGaps(policies),
    computeExternalExposure(partners, defaultPolicy),
    computeRiskyUsers(riskyUsers, riskDetections),
    computeAppOverPermissioning(servicePrincipals),
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
