import type { RiskSeverity, RiskCategory } from "./risk-scoring"

// ── Local helpers (duplicated from risk-scoring.ts) ──────────────────

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

// ── Input types ──────────────────────────────────────────────────────

export type CaBypassPolicy = {
  id: string
  displayName: string
  state: string
  conditions: {
    users?: {
      includeUsers?: string[]
      excludeUsers?: string[]
      includeGroups?: string[]
      excludeGroups?: string[]
      includeRoles?: string[]
      excludeRoles?: string[]
    }
    applications?: {
      includeApplications?: string[]
      excludeApplications?: string[]
    }
    platforms?: {
      includePlatforms?: string[]
      excludePlatforms?: string[]
    }
    locations?: {
      includeLocations?: string[]
      excludeLocations?: string[]
    }
    clientAppTypes?: string[]
    signInRiskLevels?: string[]
    userRiskLevels?: string[]
  }
  grantControls: {
    operator?: string
    builtInControls?: string[]
    authenticationStrength?: { id?: string; displayName?: string }
  } | null
  sessionControls: {
    signInFrequency?: { isEnabled?: boolean; value?: number; type?: string }
    persistentBrowser?: { isEnabled?: boolean; mode?: string }
    continuousAccessEvaluation?: { mode?: string }
    cloudAppSecurity?: { isEnabled?: boolean }
  } | null
}

export type CaBypassNamedLocation = {
  id: string
  displayName: string
  isTrusted?: boolean
}

// ── Output types ─────────────────────────────────────────────────────

export type CaBypassStats = {
  totalPolicies: number
  enforcedPolicies: number
  reportOnlyPolicies: number
  disabledPolicies: number
  legacyAuthBlocked: boolean
  mfaExclusionCount: number
  trustedLocationCount: number
  uncoveredPlatforms: number
  weakSessionPolicies: number
  unprotectedAdminRoles: number
}

export type CaBypassFinding = {
  id: string
  category: string
  severity: RiskSeverity
  title: string
  description: string
  policyName?: string
  bypassTechnique: string
  opsecRating: 1 | 2 | 3 | 4 | 5
}

export type CaBypassAssessment = {
  aggregateScore: number
  severity: RiskSeverity
  categories: RiskCategory[]
  stats: CaBypassStats
  findings: CaBypassFinding[]
}

// ── Constants ────────────────────────────────────────────────────────

const ALL_PLATFORMS = ["windows", "macOS", "iOS", "android", "linux"]

const ADMIN_ROLE_IDS: Record<string, string> = {
  "62e90394-69f5-4237-9190-012177145e10": "Global Administrator",
  "e8611ab8-c189-46e8-94e1-60213ab1f814": "Privileged Role Administrator",
  "29232cdf-9323-42fd-ade2-1d097af3e4de": "Exchange Administrator",
  "f28a1f50-f6e7-4571-818b-6a12f2af6b6c": "SharePoint Administrator",
  "fe930be7-5e62-47db-91af-98c3a49a38b1": "User Administrator",
  "194ae4cb-b126-40b2-bd5b-6091b380977d": "Security Administrator",
  "9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3": "Application Administrator",
  "158c047a-c907-4556-b7ef-446551a6b5f7": "Cloud Application Administrator",
  "b0f54661-2d74-4c50-afa3-1ec803f12efe": "Billing Administrator",
  "b1be1c3e-b65d-4f19-8427-f6fa0d97feb9": "Conditional Access Administrator",
}

const PHISHING_RESISTANT_STRENGTHS = new Set([
  "phishingResistant",
  "Phishing-resistant MFA",
  "00000000-0000-0000-0000-000000000004",
])

// ── Helpers ──────────────────────────────────────────────────────────

function isEnforced(policy: CaBypassPolicy): boolean {
  return policy.state === "enabled"
}

function isReportOnly(policy: CaBypassPolicy): boolean {
  return policy.state === "enabledForReportingButNotEnforced"
}

function isActive(policy: CaBypassPolicy): boolean {
  return isEnforced(policy) || isReportOnly(policy)
}

function requiresMfa(policy: CaBypassPolicy): boolean {
  return (
    policy.grantControls?.builtInControls?.includes("mfa") === true ||
    policy.grantControls?.authenticationStrength?.id !== undefined
  )
}

function isBlockPolicy(policy: CaBypassPolicy): boolean {
  return policy.grantControls?.builtInControls?.includes("block") === true
}

function targetsAllUsers(policy: CaBypassPolicy): boolean {
  return policy.conditions.users?.includeUsers?.includes("All") === true
}

function targetsAllApps(policy: CaBypassPolicy): boolean {
  return policy.conditions.applications?.includeApplications?.includes("All") === true
}

function getTargetedRoleIds(policy: CaBypassPolicy): string[] {
  return policy.conditions.users?.includeRoles ?? []
}

// ── Category 1: Legacy Auth Exposure (20%) ───────────────────────────

function computeLegacyAuthExposure(policies: CaBypassPolicy[]): { category: RiskCategory; findings: CaBypassFinding[] } {
  const findings: CaBypassFinding[] = []
  const enforced = policies.filter(isEnforced)

  const legacyBlockPolicies = enforced.filter((p) => {
    const types = p.conditions.clientAppTypes ?? []
    const hasLegacyTypes = types.includes("exchangeActiveSync") || types.includes("other")
    return hasLegacyTypes && isBlockPolicy(p)
  })

  const blocksAllApps = legacyBlockPolicies.some(targetsAllApps)
  const blocksAllUsers = legacyBlockPolicies.some(targetsAllUsers)
  const fullBlock = blocksAllApps && blocksAllUsers

  let score: number
  if (legacyBlockPolicies.length === 0) {
    score = 4
    findings.push({
      id: "legacy-no-block",
      category: "Legacy Auth Exposure",
      severity: "critical",
      title: "No policy blocks legacy authentication protocols",
      description: "Legacy authentication protocols (IMAP, POP3, SMTP, ActiveSync basic auth) bypass MFA entirely. No Conditional Access policy blocks these protocols.",
      bypassTechnique: "Authenticate via IMAP/POP3/SMTP using username:password. Legacy protocols do not support MFA challenges, granting mailbox access without a second factor.",
      opsecRating: 2,
    })
    findings.push({
      id: "legacy-activesync-spray",
      category: "Legacy Auth Exposure",
      severity: "critical",
      title: "ActiveSync basic auth available for password spraying",
      description: "Exchange ActiveSync with basic authentication is not blocked, enabling automated credential spraying against the /Microsoft-Server-ActiveSync endpoint.",
      bypassTechnique: "Use tools like MailSniper or SprayingToolkit against /Microsoft-Server-ActiveSync with basic auth headers. Rate limiting is weaker on legacy endpoints.",
      opsecRating: 3,
    })
  } else if (!fullBlock) {
    score = 3
    const partialPolicies = legacyBlockPolicies.filter((p) => !targetsAllApps(p) || !targetsAllUsers(p))
    for (const p of partialPolicies) {
      const excludedUsers = p.conditions.users?.excludeUsers ?? []
      const excludedGroups = p.conditions.users?.excludeGroups ?? []
      if (excludedUsers.length > 0 || excludedGroups.length > 0) {
        findings.push({
          id: `legacy-partial-${p.id}`,
          category: "Legacy Auth Exposure",
          severity: "high",
          title: `Legacy auth block has user exclusions: ${p.displayName}`,
          description: `Policy "${p.displayName}" blocks legacy auth but excludes ${excludedUsers.length} user(s) and ${excludedGroups.length} group(s). These excluded identities can still authenticate via legacy protocols.`,
          policyName: p.displayName,
          bypassTechnique: "Identify excluded users/groups via directory enumeration, then authenticate as those accounts using IMAP/POP3 to bypass MFA.",
          opsecRating: 2,
        })
      }
    }
    if (findings.length === 0) {
      findings.push({
        id: "legacy-partial-coverage",
        category: "Legacy Auth Exposure",
        severity: "high",
        title: "Legacy auth block does not cover all users or all apps",
        description: "At least one legacy auth block policy exists, but it does not target all users and all applications. Unprotected users or apps remain vulnerable.",
        bypassTechnique: "Enumerate which applications or users are excluded from the legacy auth block, then authenticate via those gaps using IMAP/POP3/SMTP basic auth.",
        opsecRating: 2,
      })
    }
  } else {
    score = 1
  }

  const details: string[] = []
  if (legacyBlockPolicies.length === 0) {
    details.push("No legacy auth block policies found")
    details.push("Vulnerable protocols: IMAP, POP3, SMTP, ActiveSync (basic auth)")
  } else {
    details.push(summarizeList(legacyBlockPolicies, "Legacy auth block policies", (p) => p.displayName))
    if (!fullBlock) details.push("Block does not cover all users and all applications")
  }

  return {
    category: {
      id: "legacy-auth",
      label: "Legacy Auth Exposure",
      severity: severityFromScore(score),
      score,
      weight: 20,
      metric: legacyBlockPolicies.length === 0
        ? "No legacy auth blocking"
        : `${legacyBlockPolicies.length} block ${legacyBlockPolicies.length !== 1 ? "policies" : "policy"}, ${fullBlock ? "full" : "partial"} coverage`,
      details,
    },
    findings,
  }
}

// ── Category 2: MFA Bypass Windows (25%) ─────────────────────────────

function computeMfaBypassWindows(policies: CaBypassPolicy[]): { category: RiskCategory; findings: CaBypassFinding[] } {
  const findings: CaBypassFinding[] = []
  const mfaPolicies = policies.filter((p) => isActive(p) && requiresMfa(p))
  const enforcedMfa = mfaPolicies.filter(isEnforced)
  const reportOnlyMfa = mfaPolicies.filter(isReportOnly)

  let totalExcludedUsers = 0
  let totalExcludedGroups = 0
  let totalExcludedApps = 0

  for (const p of enforcedMfa) {
    const exUsers = p.conditions.users?.excludeUsers ?? []
    const exGroups = p.conditions.users?.excludeGroups ?? []
    const exApps = p.conditions.applications?.excludeApplications ?? []
    totalExcludedUsers += exUsers.length
    totalExcludedGroups += exGroups.length
    totalExcludedApps += exApps.length

    if (exUsers.length > 0) {
      findings.push({
        id: `mfa-excl-users-${p.id}`,
        category: "MFA Bypass Windows",
        severity: "high",
        title: `MFA policy excludes ${exUsers.length} user(s): ${p.displayName}`,
        description: `Policy "${p.displayName}" enforces MFA but explicitly excludes ${exUsers.length} user(s). These accounts authenticate with password-only.`,
        policyName: p.displayName,
        bypassTechnique: "Compromise an excluded user's password via phishing, credential stuffing, or password spray. MFA is not enforced for these identities — single-factor auth grants full access.",
        opsecRating: 2,
      })
    }

    if (exGroups.length > 0) {
      findings.push({
        id: `mfa-excl-groups-${p.id}`,
        category: "MFA Bypass Windows",
        severity: "high",
        title: `MFA policy excludes ${exGroups.length} group(s): ${p.displayName}`,
        description: `Policy "${p.displayName}" enforces MFA but excludes ${exGroups.length} group(s). Members of excluded groups bypass the MFA requirement.`,
        policyName: p.displayName,
        bypassTechnique: "Enumerate excluded group membership via Graph API. Add a compromised user to the excluded group (if write access is available) or target members of those groups for credential attacks.",
        opsecRating: 2,
      })
    }

    if (exApps.length > 0) {
      findings.push({
        id: `mfa-excl-apps-${p.id}`,
        category: "MFA Bypass Windows",
        severity: "medium",
        title: `MFA policy excludes ${exApps.length} application(s): ${p.displayName}`,
        description: `Policy "${p.displayName}" enforces MFA but excludes ${exApps.length} application(s). Authentication to excluded apps does not require a second factor.`,
        policyName: p.displayName,
        bypassTechnique: "Authenticate to an excluded application using stolen credentials. If the excluded app has broad OAuth scopes (e.g., Graph API access), pivot from the app token to access protected resources.",
        opsecRating: 1,
      })
    }
  }

  for (const p of reportOnlyMfa) {
    findings.push({
      id: `mfa-report-only-${p.id}`,
      category: "MFA Bypass Windows",
      severity: "high",
      title: `MFA policy in report-only mode: ${p.displayName}`,
      description: `Policy "${p.displayName}" requires MFA but is set to report-only. It logs MFA-would-have-been-required events but does NOT enforce them. Authentication succeeds without MFA.`,
      policyName: p.displayName,
      bypassTechnique: "Authenticate normally with password-only. Report-only policies generate audit logs but never block sign-ins. The SOC may see 'reportOnlyFailure' events in sign-in logs but access is granted.",
      opsecRating: 1,
    })
  }

  const exclusionGaps = totalExcludedUsers + totalExcludedGroups + totalExcludedApps + reportOnlyMfa.length

  let score: number
  if (enforcedMfa.length === 0 && reportOnlyMfa.length > 0) score = 4
  else if (exclusionGaps > 5) score = 4
  else if (exclusionGaps > 2) score = 3
  else if (exclusionGaps > 0) score = 2
  else score = 1

  const details: string[] = []
  if (enforcedMfa.length === 0 && reportOnlyMfa.length === 0) {
    details.push("No MFA policies found (enforced or report-only)")
  } else {
    details.push(`${enforcedMfa.length} enforced MFA ${enforcedMfa.length !== 1 ? "policies" : "policy"}, ${reportOnlyMfa.length} report-only`)
    if (totalExcludedUsers > 0) details.push(`${totalExcludedUsers} excluded user(s) across MFA policies`)
    if (totalExcludedGroups > 0) details.push(`${totalExcludedGroups} excluded group(s) across MFA policies`)
    if (totalExcludedApps > 0) details.push(`${totalExcludedApps} excluded application(s) across MFA policies`)
  }

  return {
    category: {
      id: "mfa-bypass",
      label: "MFA Bypass Windows",
      severity: severityFromScore(score),
      score,
      weight: 25,
      metric: exclusionGaps > 0
        ? `${exclusionGaps} exclusion gap${exclusionGaps !== 1 ? "s" : ""} across ${mfaPolicies.length} MFA ${mfaPolicies.length !== 1 ? "policies" : "policy"}`
        : `${mfaPolicies.length} MFA ${mfaPolicies.length !== 1 ? "policies" : "policy"}, no exclusion gaps`,
      details,
    },
    findings,
  }
}

// ── Category 3: Location-Based Bypass (15%) ──────────────────────────

function computeLocationBypass(
  policies: CaBypassPolicy[],
  namedLocations: CaBypassNamedLocation[],
): { category: RiskCategory; findings: CaBypassFinding[] } {
  const findings: CaBypassFinding[] = []
  const enforced = policies.filter(isEnforced)
  const trustedLocations = namedLocations.filter((l) => l.isTrusted)
  const locationLocationMap = new Map(namedLocations.map((l) => [l.id, l.displayName]))

  const policiesWithExcludedLocations = enforced.filter(
    (p) => (p.conditions.locations?.excludeLocations?.length ?? 0) > 0,
  )

  const locationOnlyPolicies = enforced.filter((p) => {
    const hasLocationCondition = (p.conditions.locations?.includeLocations?.length ?? 0) > 0
    const hasGrantControls = (p.grantControls?.builtInControls?.length ?? 0) > 0
    const hasAuthStrength = p.grantControls?.authenticationStrength?.id !== undefined
    return hasLocationCondition && !hasGrantControls && !hasAuthStrength
  })

  for (const p of policiesWithExcludedLocations) {
    const excludedIds = p.conditions.locations?.excludeLocations ?? []
    const excludedNames = excludedIds.map((id) => locationLocationMap.get(id) ?? id)

    findings.push({
      id: `loc-excluded-${p.id}`,
      category: "Location-Based Bypass",
      severity: "medium",
      title: `Policy trusts excluded locations: ${p.displayName}`,
      description: `Policy "${p.displayName}" excludes ${excludedIds.length} trusted location(s): ${excludedNames.join(", ")}. Connections from these locations bypass this policy entirely.`,
      policyName: p.displayName,
      bypassTechnique: "Route traffic through a VPN endpoint or compromised host within a trusted IP range. If the trusted location uses broad CIDR ranges (e.g., /16 or larger), find any machine in that range to proxy through.",
      opsecRating: 2,
    })
  }

  for (const p of locationOnlyPolicies) {
    findings.push({
      id: `loc-only-grant-${p.id}`,
      category: "Location-Based Bypass",
      severity: "high",
      title: `Policy relies solely on location for access control: ${p.displayName}`,
      description: `Policy "${p.displayName}" uses location as the only grant control — no MFA, no device compliance. Any connection from an untrusted location is blocked, but connections from trusted locations have no additional verification.`,
      policyName: p.displayName,
      bypassTechnique: "Establish a proxy or VPN exit within the trusted IP range. Once traffic originates from a trusted location, no further controls are applied — password-only auth is accepted.",
      opsecRating: 2,
    })
  }

  if (trustedLocations.length > 5) {
    findings.push({
      id: "loc-excessive-trusted",
      category: "Location-Based Bypass",
      severity: "medium",
      title: `${trustedLocations.length} trusted locations increase attack surface`,
      description: `The tenant defines ${trustedLocations.length} trusted named locations. A large number of trusted locations increases the probability that an attacker can find a proxy or compromised host within a trusted IP range.`,
      bypassTechnique: "Enumerate all trusted location IP ranges via Graph API (/identity/conditionalAccess/namedLocations). Scan those ranges for vulnerable services, then pivot through a compromised host to authenticate from a trusted location.",
      opsecRating: 3,
    })
  }

  const gapCount = policiesWithExcludedLocations.length + locationOnlyPolicies.length

  let score: number
  if (locationOnlyPolicies.length > 0 && trustedLocations.length > 3) score = 4
  else if (gapCount > 3) score = 3
  else if (gapCount > 0) score = 2
  else score = 1

  const details: string[] = []
  details.push(`${trustedLocations.length} trusted location${trustedLocations.length !== 1 ? "s" : ""} defined`)
  if (policiesWithExcludedLocations.length > 0) {
    details.push(`${policiesWithExcludedLocations.length} ${policiesWithExcludedLocations.length !== 1 ? "policies" : "policy"} with location exclusions`)
  }
  if (locationOnlyPolicies.length > 0) {
    details.push(`${locationOnlyPolicies.length} ${locationOnlyPolicies.length !== 1 ? "policies" : "policy"} using location as sole control`)
  }

  return {
    category: {
      id: "location-bypass",
      label: "Location-Based Bypass",
      severity: severityFromScore(score),
      score,
      weight: 15,
      metric: gapCount > 0
        ? `${gapCount} location-dependent gap${gapCount !== 1 ? "s" : ""}`
        : `${trustedLocations.length} trusted location${trustedLocations.length !== 1 ? "s" : ""}, no gaps`,
      details,
    },
    findings,
  }
}

// ── Category 4: Platform & Device Gaps (15%) ─────────────────────────

function computePlatformDeviceGaps(policies: CaBypassPolicy[]): { category: RiskCategory; findings: CaBypassFinding[] } {
  const findings: CaBypassFinding[] = []
  const enforced = policies.filter(isEnforced)

  const coveredPlatforms = new Set<string>()
  for (const p of enforced) {
    const include = p.conditions.platforms?.includePlatforms ?? []
    if (include.includes("all")) {
      ALL_PLATFORMS.forEach((plat) => coveredPlatforms.add(plat))
    } else {
      include.forEach((plat) => coveredPlatforms.add(plat))
    }
  }

  const uncoveredPlatforms = ALL_PLATFORMS.filter((plat) => !coveredPlatforms.has(plat))

  if (uncoveredPlatforms.length > 0) {
    findings.push({
      id: "platform-uncovered",
      category: "Platform & Device Gaps",
      severity: uncoveredPlatforms.length >= 3 ? "high" : "medium",
      title: `${uncoveredPlatforms.length} platform(s) not covered by any CA policy`,
      description: `No enforced CA policy targets: ${uncoveredPlatforms.join(", ")}. Users on these platforms may bypass Conditional Access controls entirely.`,
      bypassTechnique: `Spoof the User-Agent string to an uncovered platform (${uncoveredPlatforms[0]}). If policies only target specific platforms, requests from unrecognized platforms may not trigger any policy evaluation.`,
      opsecRating: 1,
    })
  }

  for (const p of enforced) {
    const excluded = p.conditions.platforms?.excludePlatforms ?? []
    if (excluded.length > 0) {
      findings.push({
        id: `platform-excl-${p.id}`,
        category: "Platform & Device Gaps",
        severity: "medium",
        title: `Policy excludes ${excluded.length} platform(s): ${p.displayName}`,
        description: `Policy "${p.displayName}" explicitly excludes: ${excluded.join(", ")}. Users on excluded platforms are not subject to this policy's controls.`,
        policyName: p.displayName,
        bypassTechnique: `Set the User-Agent to an excluded platform (${excluded[0]}). Azure AD reads the platform from the User-Agent header during policy evaluation, so forging it can bypass platform-targeted policies.`,
        opsecRating: 1,
      })
    }
  }

  const compliancePolicies = enforced.filter(
    (p) =>
      p.grantControls?.builtInControls?.includes("compliantDevice") === true ||
      p.grantControls?.builtInControls?.includes("domainJoinedDevice") === true,
  )

  if (compliancePolicies.length === 0 && enforced.length > 0) {
    findings.push({
      id: "device-no-compliance",
      category: "Platform & Device Gaps",
      severity: "medium",
      title: "No policy requires device compliance or domain join",
      description: "No enforced CA policy requires compliantDevice or domainJoinedDevice. Users can authenticate from any unmanaged device, including attacker-controlled machines.",
      bypassTechnique: "Authenticate from any unmanaged device or virtual machine. Without device compliance requirements, stolen credentials work from any endpoint regardless of Intune enrollment or domain membership.",
      opsecRating: 1,
    })
  }

  const noPlatformPolicies = enforced.filter(
    (p) => !p.conditions.platforms && requiresMfa(p) && targetsAllUsers(p),
  )
  if (noPlatformPolicies.length > 0 && uncoveredPlatforms.length > 0) {
    // Policies without platform conditions apply to all platforms — reduce severity
    uncoveredPlatforms.length = 0
  }

  let score: number
  if (uncoveredPlatforms.length >= 3) score = 4
  else if (uncoveredPlatforms.length >= 1 || compliancePolicies.length === 0) score = 3
  else if (enforced.some((p) => (p.conditions.platforms?.excludePlatforms?.length ?? 0) > 0)) score = 2
  else score = 1

  const details: string[] = []
  if (uncoveredPlatforms.length > 0) {
    details.push(`Uncovered platforms: ${uncoveredPlatforms.join(", ")}`)
  } else {
    details.push("All platforms covered by at least one policy")
  }
  if (compliancePolicies.length > 0) {
    details.push(`${compliancePolicies.length} ${compliancePolicies.length !== 1 ? "policies" : "policy"} requiring device compliance`)
  } else if (enforced.length > 0) {
    details.push("No device compliance requirements in any policy")
  }

  return {
    category: {
      id: "platform-device",
      label: "Platform & Device Gaps",
      severity: severityFromScore(score),
      score,
      weight: 15,
      metric: uncoveredPlatforms.length > 0
        ? `${uncoveredPlatforms.length} uncovered platform${uncoveredPlatforms.length !== 1 ? "s" : ""}`
        : `All platforms covered, ${compliancePolicies.length} compliance ${compliancePolicies.length !== 1 ? "policies" : "policy"}`,
      details,
    },
    findings,
  }
}

// ── Category 5: Session Control Weaknesses (10%) ─────────────────────

function computeSessionWeaknesses(policies: CaBypassPolicy[]): { category: RiskCategory; findings: CaBypassFinding[] } {
  const findings: CaBypassFinding[] = []
  const enforced = policies.filter(isEnforced)

  let weakSessionCount = 0

  const persistentBrowserPolicies = enforced.filter(
    (p) =>
      p.sessionControls?.persistentBrowser?.isEnabled === true &&
      p.sessionControls.persistentBrowser.mode === "always",
  )

  for (const p of persistentBrowserPolicies) {
    weakSessionCount++
    findings.push({
      id: `session-persistent-${p.id}`,
      category: "Session Control Weaknesses",
      severity: "medium",
      title: `Persistent browser session enabled: ${p.displayName}`,
      description: `Policy "${p.displayName}" allows persistent browser sessions (mode: always). Users remain authenticated across browser restarts without re-authentication.`,
      policyName: p.displayName,
      bypassTechnique: "Steal the browser session cookie (via XSS, cookie theft malware, or physical access). Persistent sessions survive browser restarts, extending the window for session hijacking significantly.",
      opsecRating: 2,
    })
  }

  const weakFrequencyPolicies = enforced.filter((p) => {
    const freq = p.sessionControls?.signInFrequency
    if (!freq?.isEnabled) return false
    if (freq.type === "hours" && (freq.value ?? 0) > 24) return true
    if (freq.type === "days" && (freq.value ?? 0) > 1) return true
    return false
  })

  for (const p of weakFrequencyPolicies) {
    const freq = p.sessionControls!.signInFrequency!
    weakSessionCount++
    findings.push({
      id: `session-freq-${p.id}`,
      category: "Session Control Weaknesses",
      severity: "medium",
      title: `Long sign-in frequency (${freq.value} ${freq.type}): ${p.displayName}`,
      description: `Policy "${p.displayName}" sets sign-in frequency to ${freq.value} ${freq.type}. Token refresh is not required for extended periods, increasing the window for token replay.`,
      policyName: p.displayName,
      bypassTechnique: "Steal a refresh token or session cookie. With long sign-in frequency, the token remains valid for extended periods without reauthentication, giving more time to operate before the session expires.",
      opsecRating: 1,
    })
  }

  const noFrequencyPolicies = enforced.filter(
    (p) => requiresMfa(p) && targetsAllUsers(p) && !p.sessionControls?.signInFrequency?.isEnabled,
  )

  if (noFrequencyPolicies.length > 0) {
    weakSessionCount++
    findings.push({
      id: "session-no-frequency",
      category: "Session Control Weaknesses",
      severity: "low",
      title: `${noFrequencyPolicies.length} MFA ${noFrequencyPolicies.length !== 1 ? "policies" : "policy"} without sign-in frequency control`,
      description: `${noFrequencyPolicies.length} enforced MFA ${noFrequencyPolicies.length !== 1 ? "policies target" : "policy targets"} all users but ${noFrequencyPolicies.length !== 1 ? "do" : "does"} not set a sign-in frequency. Azure AD defaults apply, which may allow long-lived sessions.`,
      bypassTechnique: "After initial authentication, the session remains valid per Azure AD defaults (typically up to 90 days for refresh tokens). Steal the primary refresh token (PRT) or refresh token to maintain persistent access.",
      opsecRating: 1,
    })
  }

  const caeDisabledPolicies = enforced.filter(
    (p) => p.sessionControls?.continuousAccessEvaluation?.mode === "disabled",
  )

  if (caeDisabledPolicies.length > 0) {
    weakSessionCount++
    findings.push({
      id: "session-cae-disabled",
      category: "Session Control Weaknesses",
      severity: "medium",
      title: `Continuous access evaluation disabled in ${caeDisabledPolicies.length} ${caeDisabledPolicies.length !== 1 ? "policies" : "policy"}`,
      description: `${caeDisabledPolicies.length} ${caeDisabledPolicies.length !== 1 ? "policies disable" : "policy disables"} continuous access evaluation (CAE). Token revocation events (password change, user disable, location change) are not evaluated in real-time.`,
      bypassTechnique: "After compromising credentials, changes to the account (password reset, account disable, MFA re-registration) do not immediately invalidate existing tokens. Continue using stolen tokens for up to 1 hour after revocation.",
      opsecRating: 1,
    })
  }

  const noCloudAppSecurity = enforced.filter(
    (p) => requiresMfa(p) && targetsAllApps(p) && !p.sessionControls?.cloudAppSecurity?.isEnabled,
  )

  if (noCloudAppSecurity.length > 0 && enforced.length > 0) {
    findings.push({
      id: "session-no-mcas",
      category: "Session Control Weaknesses",
      severity: "low",
      title: "No cloud app security session monitoring",
      description: "No enforced policy enables Defender for Cloud Apps session monitoring. Anomalous session behavior (impossible travel, bulk downloads) is not intercepted at the proxy layer.",
      bypassTechnique: "Perform data exfiltration (bulk file downloads, mailbox export) without session-level DLP controls. Without MCAS proxy, actions within the session are not inspected or blocked.",
      opsecRating: 1,
    })
  }

  let score: number
  if (weakSessionCount >= 4) score = 4
  else if (weakSessionCount >= 2) score = 3
  else if (weakSessionCount >= 1) score = 2
  else score = 1

  const details: string[] = []
  if (persistentBrowserPolicies.length > 0) {
    details.push(`${persistentBrowserPolicies.length} ${persistentBrowserPolicies.length !== 1 ? "policies" : "policy"} with persistent browser sessions`)
  }
  if (weakFrequencyPolicies.length > 0) {
    details.push(`${weakFrequencyPolicies.length} ${weakFrequencyPolicies.length !== 1 ? "policies" : "policy"} with sign-in frequency >24h`)
  }
  if (caeDisabledPolicies.length > 0) {
    details.push(`${caeDisabledPolicies.length} ${caeDisabledPolicies.length !== 1 ? "policies" : "policy"} with CAE disabled`)
  }
  if (details.length === 0) {
    details.push("No weak session configurations detected")
  }

  return {
    category: {
      id: "session-controls",
      label: "Session Control Weaknesses",
      severity: severityFromScore(score),
      score,
      weight: 10,
      metric: `${weakSessionCount} session weakness${weakSessionCount !== 1 ? "es" : ""}`,
      details,
    },
    findings,
  }
}

// ── Category 6: Admin Protection Gaps (15%) ──────────────────────────

function computeAdminProtectionGaps(policies: CaBypassPolicy[]): { category: RiskCategory; findings: CaBypassFinding[] } {
  const findings: CaBypassFinding[] = []
  const enforced = policies.filter(isEnforced)

  const adminPolicies = enforced.filter((p) => {
    const roles = getTargetedRoleIds(p)
    return roles.some((r) => r in ADMIN_ROLE_IDS)
  })

  const protectedRoleIds = new Set<string>()
  for (const p of adminPolicies) {
    const roles = getTargetedRoleIds(p)
    for (const r of roles) {
      if (r in ADMIN_ROLE_IDS) protectedRoleIds.add(r)
    }
  }

  const allUserMfaPolicies = enforced.filter(
    (p) => targetsAllUsers(p) && requiresMfa(p),
  )
  const hasGeneralMfa = allUserMfaPolicies.length > 0

  const unprotectedRoles = Object.entries(ADMIN_ROLE_IDS).filter(
    ([id]) => !protectedRoleIds.has(id),
  )

  if (adminPolicies.length === 0 && !hasGeneralMfa) {
    findings.push({
      id: "admin-no-policy",
      category: "Admin Protection Gaps",
      severity: "critical",
      title: "No CA policy specifically protects admin roles",
      description: "No enforced Conditional Access policy targets admin directory roles, and no general MFA policy covers all users. Admin accounts may authenticate with password-only.",
      bypassTechnique: "Target admin accounts via password spray, phishing, or credential stuffing. Without any MFA requirement, a compromised admin password grants immediate privileged access to the tenant.",
      opsecRating: 3,
    })
  } else if (adminPolicies.length === 0 && hasGeneralMfa) {
    findings.push({
      id: "admin-no-dedicated",
      category: "Admin Protection Gaps",
      severity: "medium",
      title: "Admin roles lack dedicated CA policies (rely on general MFA)",
      description: "Admin roles are protected only by general all-user MFA policies. No dedicated policy enforces stronger controls (phishing-resistant MFA, device compliance) for privileged accounts.",
      bypassTechnique: "Admin accounts are subject to the same MFA as regular users. If the general MFA allows weaker methods (SMS, phone call), perform real-time phishing with tools like Evilginx2 to capture the MFA token and session cookie.",
      opsecRating: 3,
    })
  }

  if (unprotectedRoles.length > 0 && adminPolicies.length > 0) {
    const unprotectedNames = unprotectedRoles.map(([, name]) => name)
    findings.push({
      id: "admin-partial-coverage",
      category: "Admin Protection Gaps",
      severity: "high",
      title: `${unprotectedRoles.length} admin role(s) not targeted by any admin-specific CA policy`,
      description: `The following admin roles are not explicitly targeted by any dedicated CA policy: ${unprotectedNames.join(", ")}. These roles may have weaker controls than other admin roles.`,
      bypassTechnique: "Focus attacks on accounts with unprotected admin roles. If a role like Application Administrator is unprotected, compromise that account to register malicious applications with broad permissions.",
      opsecRating: 2,
    })
  }

  const adminPhishingResistant = adminPolicies.filter((p) => {
    const strength = p.grantControls?.authenticationStrength
    if (strength) {
      return (
        PHISHING_RESISTANT_STRENGTHS.has(strength.id ?? "") ||
        PHISHING_RESISTANT_STRENGTHS.has(strength.displayName ?? "")
      )
    }
    return false
  })

  if (adminPolicies.length > 0 && adminPhishingResistant.length === 0) {
    findings.push({
      id: "admin-no-phishing-resistant",
      category: "Admin Protection Gaps",
      severity: "high",
      title: "No admin policy requires phishing-resistant MFA",
      description: "Admin-targeted CA policies exist but none require phishing-resistant authentication (FIDO2, Windows Hello, certificate-based). Admins may use weaker MFA methods (push notification, SMS) that are vulnerable to real-time phishing.",
      bypassTechnique: "Deploy an AiTM (adversary-in-the-middle) phishing proxy (Evilginx2, Modlishka) targeting admin accounts. Intercept the MFA token and session cookie in real-time. Push notification and SMS MFA are fully bypassable with this technique.",
      opsecRating: 4,
    })
  }

  const adminExcludedFromMfa = enforced.filter((p) => {
    if (!requiresMfa(p)) return false
    const excludedRoles = p.conditions.users?.excludeRoles ?? []
    return excludedRoles.some((r) => r in ADMIN_ROLE_IDS)
  })

  for (const p of adminExcludedFromMfa) {
    const excludedRoles = (p.conditions.users?.excludeRoles ?? []).filter((r) => r in ADMIN_ROLE_IDS)
    const excludedNames = excludedRoles.map((r) => ADMIN_ROLE_IDS[r]).filter(Boolean)
    findings.push({
      id: `admin-excluded-mfa-${p.id}`,
      category: "Admin Protection Gaps",
      severity: "critical",
      title: `Admin roles excluded from MFA policy: ${p.displayName}`,
      description: `Policy "${p.displayName}" enforces MFA but explicitly excludes admin roles: ${excludedNames.join(", ")}. These privileged accounts are not required to perform MFA.`,
      policyName: p.displayName,
      bypassTechnique: "Compromised admin credentials grant immediate access without any MFA challenge. Target excluded admin accounts via password spray or phishing for single-factor privileged access.",
      opsecRating: 3,
    })
  }

  const unprotectedCount = hasGeneralMfa
    ? unprotectedRoles.filter(([id]) => {
        // Check if excluded from general MFA
        return allUserMfaPolicies.some((p) =>
          (p.conditions.users?.excludeRoles ?? []).includes(id),
        )
      }).length
    : unprotectedRoles.length

  let score: number
  if (adminPolicies.length === 0 && !hasGeneralMfa) score = 4
  else if (adminExcludedFromMfa.length > 0) score = 4
  else if (adminPolicies.length === 0 || adminPhishingResistant.length === 0) score = 3
  else if (unprotectedRoles.length > 3) score = 2
  else score = 1

  const details: string[] = []
  if (adminPolicies.length > 0) {
    details.push(`${adminPolicies.length} admin-targeted ${adminPolicies.length !== 1 ? "policies" : "policy"}`)
    details.push(`${protectedRoleIds.size} of ${Object.keys(ADMIN_ROLE_IDS).length} admin roles explicitly protected`)
  } else {
    details.push("No admin-specific CA policies")
    if (hasGeneralMfa) details.push("Admin roles rely on general all-user MFA policy")
  }
  if (adminPhishingResistant.length > 0) {
    details.push(`${adminPhishingResistant.length} ${adminPhishingResistant.length !== 1 ? "policies" : "policy"} requiring phishing-resistant MFA`)
  }
  if (adminExcludedFromMfa.length > 0) {
    details.push(`${adminExcludedFromMfa.length} ${adminExcludedFromMfa.length !== 1 ? "policies" : "policy"} explicitly excluding admin roles from MFA`)
  }

  return {
    category: {
      id: "admin-protection",
      label: "Admin Protection Gaps",
      severity: severityFromScore(score),
      score,
      weight: 15,
      metric: adminPolicies.length > 0
        ? `${protectedRoleIds.size}/${Object.keys(ADMIN_ROLE_IDS).length} admin roles protected`
        : `No admin-specific policies${hasGeneralMfa ? " (general MFA only)" : ""}`,
      details,
    },
    findings,
  }
}

// ── Main assessment function ─────────────────────────────────────────

export function computeCaBypassAssessment(
  policies: CaBypassPolicy[],
  namedLocations: CaBypassNamedLocation[],
): CaBypassAssessment {
  const enforced = policies.filter(isEnforced)
  const reportOnly = policies.filter(isReportOnly)
  const disabled = policies.filter((p) => p.state === "disabled")

  const legacyResult = computeLegacyAuthExposure(policies)
  const mfaResult = computeMfaBypassWindows(policies)
  const locationResult = computeLocationBypass(policies, namedLocations)
  const platformResult = computePlatformDeviceGaps(policies)
  const sessionResult = computeSessionWeaknesses(policies)
  const adminResult = computeAdminProtectionGaps(policies)

  const categories: RiskCategory[] = [
    legacyResult.category,
    mfaResult.category,
    locationResult.category,
    platformResult.category,
    sessionResult.category,
    adminResult.category,
  ]

  const allFindings: CaBypassFinding[] = [
    ...legacyResult.findings,
    ...mfaResult.findings,
    ...locationResult.findings,
    ...platformResult.findings,
    ...sessionResult.findings,
    ...adminResult.findings,
  ]

  const legacyBlockPolicies = enforced.filter((p) => {
    const types = p.conditions.clientAppTypes ?? []
    return (types.includes("exchangeActiveSync") || types.includes("other")) && isBlockPolicy(p)
  })

  const mfaPolicies = policies.filter((p) => isActive(p) && requiresMfa(p))
  const trustedLocations = namedLocations.filter((l) => l.isTrusted)

  const uncoveredPlatforms = new Set(ALL_PLATFORMS)
  for (const p of enforced) {
    const include = p.conditions.platforms?.includePlatforms ?? []
    if (include.includes("all") || !p.conditions.platforms) {
      uncoveredPlatforms.clear()
      break
    }
    include.forEach((plat) => uncoveredPlatforms.delete(plat))
  }

  const weakSessionPolicies = enforced.filter(
    (p) =>
      (p.sessionControls?.persistentBrowser?.isEnabled === true &&
        p.sessionControls.persistentBrowser.mode === "always") ||
      (p.sessionControls?.signInFrequency?.isEnabled === true &&
        ((p.sessionControls.signInFrequency.type === "hours" && (p.sessionControls.signInFrequency.value ?? 0) > 24) ||
          (p.sessionControls.signInFrequency.type === "days" && (p.sessionControls.signInFrequency.value ?? 0) > 1))) ||
      p.sessionControls?.continuousAccessEvaluation?.mode === "disabled",
  )

  const protectedAdminRoleIds = new Set<string>()
  for (const p of enforced) {
    const roles = getTargetedRoleIds(p)
    for (const r of roles) {
      if (r in ADMIN_ROLE_IDS) protectedAdminRoleIds.add(r)
    }
  }
  const allUserMfa = enforced.some((p) => targetsAllUsers(p) && requiresMfa(p))
  const unprotectedAdminRoles = allUserMfa
    ? 0
    : Object.keys(ADMIN_ROLE_IDS).filter((id) => !protectedAdminRoleIds.has(id)).length

  const totalExclUsers = mfaPolicies.reduce(
    (sum, p) => sum + (p.conditions.users?.excludeUsers?.length ?? 0),
    0,
  )
  const totalExclGroups = mfaPolicies.reduce(
    (sum, p) => sum + (p.conditions.users?.excludeGroups?.length ?? 0),
    0,
  )

  const stats: CaBypassStats = {
    totalPolicies: policies.length,
    enforcedPolicies: enforced.length,
    reportOnlyPolicies: reportOnly.length,
    disabledPolicies: disabled.length,
    legacyAuthBlocked: legacyBlockPolicies.length > 0,
    mfaExclusionCount: totalExclUsers + totalExclGroups,
    trustedLocationCount: trustedLocations.length,
    uncoveredPlatforms: uncoveredPlatforms.size,
    weakSessionPolicies: weakSessionPolicies.length,
    unprotectedAdminRoles,
  }

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0)
  const weightedSum = categories.reduce((sum, c) => sum + c.score * c.weight, 0)
  const aggregateScore = totalWeight > 0 ? weightedSum / totalWeight : 1

  return {
    aggregateScore,
    severity: severityFromScore(Math.round(aggregateScore)),
    categories,
    stats,
    findings: allFindings,
  }
}
