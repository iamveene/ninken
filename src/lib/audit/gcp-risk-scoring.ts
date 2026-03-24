import { type RiskSeverity, type RiskCategory, severityFromScore, summarizeList } from "./risk-scoring"

// ── Input types ────────────────────────────────────────────────────────

export type GcpBucketRiskEntry = {
  bucketName: string
  isPublic: boolean
  publicMembers: string[]
  roles: string[]
}

export type GcpFirewallRiskEntry = {
  name: string
  isOpenToWorld: boolean
  riskLevel: "critical" | "high" | "medium" | "low"
  sourceRanges: string[]
  allowed: { protocol: string; ports: string[] }[]
}

export type GcpApiKeyRestriction = {
  name: string
  hasApplicationRestrictions: boolean
  hasApiRestrictions: boolean
}

export type GcpServiceAccountKey = {
  name: string
  serviceAccountEmail: string
  keyAgeDays: number
}

export type GcpRiskInput = {
  buckets: GcpBucketRiskEntry[]
  firewallRules: GcpFirewallRiskEntry[]
  apiKeys: GcpApiKeyRestriction[]
  serviceAccountKeys: GcpServiceAccountKey[]
}

// ── Output types ───────────────────────────────────────────────────────

export type GcpRiskStats = {
  totalBuckets: number
  publicBuckets: number
  totalFirewallRules: number
  openToWorldRules: number
  unrestrictedApiKeys: number
  staleServiceAccountKeys: number
}

export type GcpRiskAssessment = {
  aggregateScore: number
  severity: RiskSeverity
  categories: RiskCategory[]
  stats: GcpRiskStats
}

// ── Category 1: Public Buckets (30%) ─────────────────────────────────

function computePublicBuckets(buckets: GcpBucketRiskEntry[]): RiskCategory {
  const total = buckets.length

  if (total === 0) {
    return {
      id: "public-buckets",
      label: "Public Buckets",
      severity: "low",
      score: 1,
      weight: 30,
      metric: "No buckets to assess",
      details: [],
      unavailable: true,
    }
  }

  const publicBuckets = buckets.filter((b) => b.isPublic)
  const pct = (publicBuckets.length / total) * 100

  let score: number
  if (publicBuckets.length > 5) score = 4
  else if (publicBuckets.length > 2) score = 3
  else if (publicBuckets.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (publicBuckets.length > 0) {
    details.push(summarizeList(publicBuckets, "Public buckets", (b) => b.bucketName))
    const allUsersCount = publicBuckets.filter((b) => b.publicMembers.includes("allUsers")).length
    if (allUsersCount > 0) {
      details.push(`${allUsersCount} bucket(s) accessible to allUsers (anonymous)`)
    }
  }

  return {
    id: "public-buckets",
    label: "Public Buckets",
    severity: severityFromScore(score),
    score,
    weight: 30,
    metric: `${publicBuckets.length} of ${total} buckets (${Math.round(pct)}%) publicly accessible`,
    details,
  }
}

// ── Category 2: Open Firewall Rules (25%) ────────────────────────────

function computeOpenFirewallRules(rules: GcpFirewallRiskEntry[]): RiskCategory {
  if (rules.length === 0) {
    return {
      id: "open-firewall",
      label: "Open Firewall Rules",
      severity: "low",
      score: 1,
      weight: 25,
      metric: "No firewall rules to assess",
      details: [],
      unavailable: true,
    }
  }

  const openRules = rules.filter((r) => r.isOpenToWorld)
  const criticalRules = openRules.filter((r) => r.riskLevel === "critical")
  const highRules = openRules.filter((r) => r.riskLevel === "high")

  let score: number
  if (criticalRules.length > 0) score = 4
  else if (highRules.length > 0) score = 3
  else if (openRules.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (criticalRules.length > 0) {
    details.push(
      summarizeList(criticalRules, "Critical (SSH/RDP/DB open to world)", (r) => r.name),
    )
  }
  if (highRules.length > 0) {
    details.push(`${highRules.length} rule(s) with high-risk ports open to 0.0.0.0/0`)
  }
  if (openRules.length > criticalRules.length + highRules.length) {
    details.push(`${openRules.length - criticalRules.length - highRules.length} other rule(s) open to world`)
  }

  return {
    id: "open-firewall",
    label: "Open Firewall Rules",
    severity: severityFromScore(score),
    score,
    weight: 25,
    metric: `${openRules.length} rule${openRules.length !== 1 ? "s" : ""} open to 0.0.0.0/0`,
    details,
  }
}

// ── Category 3: API Key Security (25%) ──────────────────────────────

function computeApiKeySecurity(apiKeys: GcpApiKeyRestriction[]): RiskCategory {
  if (apiKeys.length === 0) {
    return {
      id: "api-key-security",
      label: "API Key Security",
      severity: "low",
      score: 1,
      weight: 25,
      metric: "No API key data available",
      details: ["API Keys API access may be restricted"],
      unavailable: true,
    }
  }

  const unrestricted = apiKeys.filter((k) => !k.hasApplicationRestrictions && !k.hasApiRestrictions)
  const partiallyRestricted = apiKeys.filter(
    (k) => (k.hasApplicationRestrictions || k.hasApiRestrictions) && !(k.hasApplicationRestrictions && k.hasApiRestrictions),
  )

  let score: number
  if (unrestricted.length > 3) score = 4
  else if (unrestricted.length > 0) score = 3
  else if (partiallyRestricted.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (unrestricted.length > 0) {
    details.push(
      summarizeList(unrestricted, "Unrestricted keys", (k) => k.name.split("/").pop() ?? k.name),
    )
  }
  if (partiallyRestricted.length > 0) {
    details.push(`${partiallyRestricted.length} key(s) with partial restrictions`)
  }

  return {
    id: "api-key-security",
    label: "API Key Security",
    severity: severityFromScore(score),
    score,
    weight: 25,
    metric: `${unrestricted.length} unrestricted key${unrestricted.length !== 1 ? "s" : ""}`,
    details,
  }
}

// ── Category 4: Service Account Key Age (20%) ───────────────────────

function computeServiceAccountKeyAge(keys: GcpServiceAccountKey[]): RiskCategory {
  if (keys.length === 0) {
    return {
      id: "sa-key-age",
      label: "Service Account Key Age",
      severity: "low",
      score: 1,
      weight: 20,
      metric: "No service account key data",
      details: [],
      unavailable: true,
    }
  }

  const stale = keys.filter((k) => k.keyAgeDays > 90)
  const critical = keys.filter((k) => k.keyAgeDays > 365)
  const high = keys.filter((k) => k.keyAgeDays > 180 && k.keyAgeDays <= 365)

  let score: number
  if (critical.length > 0) score = 4
  else if (high.length > 0) score = 3
  else if (stale.length > 0) score = 2
  else score = 1

  const details: string[] = []
  if (critical.length > 0) {
    details.push(
      summarizeList(critical, "Keys >365 days", (k) => `${k.serviceAccountEmail} (${k.keyAgeDays}d)`),
    )
  }
  if (high.length > 0) {
    details.push(`${high.length} key(s) aged 180-365 days`)
  }
  if (stale.length > critical.length + high.length) {
    details.push(`${stale.length - critical.length - high.length} key(s) aged 90-180 days`)
  }

  return {
    id: "sa-key-age",
    label: "Service Account Key Age",
    severity: severityFromScore(score),
    score,
    weight: 20,
    metric: `${stale.length} key${stale.length !== 1 ? "s" : ""} older than 90 days`,
    details,
  }
}

// ── Main assessment function ────────────────────────────────────────

export function computeGcpRisk(data: GcpRiskInput): GcpRiskAssessment {
  const publicBuckets = data.buckets.filter((b) => b.isPublic)
  const openRules = data.firewallRules.filter((r) => r.isOpenToWorld)
  const unrestricted = data.apiKeys.filter((k) => !k.hasApplicationRestrictions && !k.hasApiRestrictions)
  const staleKeys = data.serviceAccountKeys.filter((k) => k.keyAgeDays > 90)

  const stats: GcpRiskStats = {
    totalBuckets: data.buckets.length,
    publicBuckets: publicBuckets.length,
    totalFirewallRules: data.firewallRules.length,
    openToWorldRules: openRules.length,
    unrestrictedApiKeys: unrestricted.length,
    staleServiceAccountKeys: staleKeys.length,
  }

  const categories: RiskCategory[] = [
    computePublicBuckets(data.buckets),
    computeOpenFirewallRules(data.firewallRules),
    computeApiKeySecurity(data.apiKeys),
    computeServiceAccountKeyAge(data.serviceAccountKeys),
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
