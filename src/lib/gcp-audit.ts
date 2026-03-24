/**
 * GCP Audit Analysis Library
 *
 * Security analysis logic for the Ninken GCP audit mode.
 * Analyzes bucket IAM policies and firewall rules for misconfigurations.
 */

export type GcpBucketAuditResult = {
  bucketName: string
  isPublic: boolean
  publicMembers: string[] // allUsers, allAuthenticatedUsers
  roles: string[]
}

export type GcpFirewallAuditResult = {
  name: string
  network: string
  direction: string
  sourceRanges: string[]
  allowed: { protocol: string; ports: string[] }[]
  isOpenToWorld: boolean // 0.0.0.0/0
  riskLevel: "critical" | "high" | "medium" | "low"
}

/** Sensitive ports that should never be open to the world */
const CRITICAL_PORTS = new Set(["22", "3389", "3306", "5432"])
const HIGH_RISK_PORTS = new Set(["1433", "6379", "27017", "9200", "8080", "8443"])

/**
 * Analyze GCS bucket IAM bindings for public access.
 * Checks for allUsers or allAuthenticatedUsers in any IAM binding.
 */
export function analyzeBucketIam(
  buckets: { name: string; iamBindings: { role: string; members: string[] }[] }[],
): GcpBucketAuditResult[] {
  return buckets.map((bucket) => {
    const publicMembers: string[] = []
    const roles: string[] = []

    for (const binding of bucket.iamBindings) {
      for (const member of binding.members) {
        if (member === "allUsers" || member === "allAuthenticatedUsers") {
          if (!publicMembers.includes(member)) publicMembers.push(member)
          if (!roles.includes(binding.role)) roles.push(binding.role)
        }
      }
    }

    return {
      bucketName: bucket.name,
      isPublic: publicMembers.length > 0,
      publicMembers,
      roles,
    }
  })
}

/**
 * Analyze GCP firewall rules for dangerous configurations.
 * Checks for 0.0.0.0/0 source ranges on ingress rules, flags
 * critical risk on sensitive ports (SSH, RDP, DB ports).
 */
export function analyzeFirewallRules(
  rules: {
    name: string
    network: string
    direction: string
    sourceRanges?: string[]
    allowed?: { IPProtocol: string; ports?: string[] }[]
    denied?: { IPProtocol: string; ports?: string[] }[]
  }[],
): GcpFirewallAuditResult[] {
  return rules
    .filter((rule) => rule.direction === "INGRESS" && rule.allowed && rule.allowed.length > 0)
    .map((rule) => {
      const sourceRanges = rule.sourceRanges ?? []
      const isOpenToWorld = sourceRanges.includes("0.0.0.0/0") || sourceRanges.includes("::/0")

      const allowed = (rule.allowed ?? []).map((a) => ({
        protocol: a.IPProtocol,
        ports: a.ports ?? ["all"],
      }))

      let riskLevel: "critical" | "high" | "medium" | "low" = "low"

      if (isOpenToWorld) {
        // Check which ports are exposed
        const allPorts = allowed.flatMap((a) => a.ports)
        const hasCriticalPort = allPorts.some(
          (p) => p === "all" || CRITICAL_PORTS.has(p) || portRangeContains(p, CRITICAL_PORTS),
        )
        const hasHighRiskPort = allPorts.some(
          (p) => HIGH_RISK_PORTS.has(p) || portRangeContains(p, HIGH_RISK_PORTS),
        )

        if (hasCriticalPort) riskLevel = "critical"
        else if (hasHighRiskPort) riskLevel = "high"
        else riskLevel = "medium"
      }

      // Extract network name from full URL
      const networkName = rule.network.split("/").pop() ?? rule.network

      return {
        name: rule.name,
        network: networkName,
        direction: rule.direction,
        sourceRanges,
        allowed,
        isOpenToWorld,
        riskLevel,
      }
    })
}

/**
 * Check if a port range string (e.g., "0-65535", "3300-3400") contains any port from the set.
 */
function portRangeContains(portSpec: string, portSet: Set<string>): boolean {
  if (!portSpec.includes("-")) return false
  const [startStr, endStr] = portSpec.split("-")
  const start = parseInt(startStr, 10)
  const end = parseInt(endStr, 10)
  if (isNaN(start) || isNaN(end)) return false
  for (const p of portSet) {
    const port = parseInt(p, 10)
    if (port >= start && port <= end) return true
  }
  return false
}
