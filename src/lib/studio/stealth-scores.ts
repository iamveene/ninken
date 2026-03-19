/**
 * 5-level OPSEC stealth scoring engine.
 * Scores operations from Ghost (undetectable) to Loud (will trigger alerts).
 */

/** Stealth level: 1 = Ghost, 2 = Silent, 3 = Cautious, 4 = Visible, 5 = Loud */
export type StealthLevel = 1 | 2 | 3 | 4 | 5

export interface StealthTier {
  level: StealthLevel
  name: string
  codename: string
  description: string
  color: string
  /** Detection probability estimate */
  detectionProbability: string
  /** Example operations at this level */
  examples: string[]
  /** OPSEC guidance */
  guidance: string[]
}

export const STEALTH_TIERS: Record<StealthLevel, StealthTier> = {
  1: {
    level: 1,
    name: "Ghost",
    codename: "GHOST",
    description: "Virtually undetectable. Normal API read operations that blend with legitimate traffic.",
    color: "emerald",
    detectionProbability: "<5%",
    examples: [
      "Reading user profile",
      "Listing calendar events",
      "Browsing contacts",
      "Checking token info",
    ],
    guidance: [
      "Rate-limit requests to match normal user patterns",
      "Use during business hours for the target timezone",
      "Minimal logging footprint in standard configurations",
    ],
  },
  2: {
    level: 2,
    name: "Silent",
    codename: "SILENT",
    description: "Low risk of detection. Read-heavy operations that may appear in detailed audit logs.",
    color: "sky",
    detectionProbability: "5-15%",
    examples: [
      "Reading email messages",
      "Downloading files from Drive",
      "Listing directory users",
      "Browsing SharePoint sites",
    ],
    guidance: [
      "Avoid bulk downloads in short time windows",
      "Spread operations across sessions",
      "These operations appear in data access logs if enabled",
    ],
  },
  3: {
    level: 3,
    name: "Cautious",
    codename: "CAUTIOUS",
    description: "Moderate detection risk. Operations that may trigger anomaly detection or appear in admin reviews.",
    color: "amber",
    detectionProbability: "15-40%",
    examples: [
      "Querying admin directory APIs",
      "Enumerating IAM roles",
      "Accessing Conditional Access policies",
      "Copying files between locations",
    ],
    guidance: [
      "May trigger anomaly-based alerts in SIEM",
      "Admin API access is often flagged in security reviews",
      "Consider timing -- avoid peak monitoring hours",
      "Use pagination to avoid large single requests",
    ],
  },
  4: {
    level: 4,
    name: "Visible",
    codename: "VISIBLE",
    description: "High detection risk. Write operations or sensitive data access that generates clear audit trails.",
    color: "orange",
    detectionProbability: "40-70%",
    examples: [
      "Sending emails from compromised account",
      "Creating service account keys",
      "Modifying file permissions",
      "Creating inbox rules",
    ],
    guidance: [
      "Will generate audit log entries visible to admins",
      "Write operations are commonly alerted on",
      "SOC teams may investigate within hours",
      "Have exit plan ready before executing",
    ],
  },
  5: {
    level: 5,
    name: "Loud",
    codename: "LOUD",
    description: "Near-certain detection. Destructive or highly anomalous operations that will trigger immediate alerts.",
    color: "red",
    detectionProbability: ">70%",
    examples: [
      "Adding email forwarding rules",
      "Granting external file access",
      "Modifying IAM policies",
      "Bulk data download operations",
      "Creating admin role assignments",
    ],
    guidance: [
      "Expect SOC response within minutes to hours",
      "These operations often trigger real-time alerts",
      "Use only when other objectives are complete",
      "Ensure persistence is established before loud operations",
      "Consider if the objective justifies the detection risk",
    ],
  },
}

/**
 * Get the stealth tier definition for a level.
 */
export function getStealthTier(level: StealthLevel): StealthTier {
  return STEALTH_TIERS[level]
}

/**
 * Calculate a composite stealth score from multiple operations.
 * Returns the highest (loudest) stealth level from the set.
 */
export function calculateCompositeScore(levels: StealthLevel[]): StealthLevel {
  if (levels.length === 0) return 1
  return Math.max(...levels) as StealthLevel
}

/**
 * Score an operation based on its properties.
 */
export function scoreOperation(params: {
  isRead: boolean
  isWrite: boolean
  isDelete: boolean
  targetsAdminApi: boolean
  targetsSensitiveData: boolean
  isBulkOperation: boolean
  createsPeristence: boolean
}): StealthLevel {
  let score: StealthLevel = 1

  if (params.isRead && !params.targetsSensitiveData && !params.targetsAdminApi) {
    score = 1
  } else if (params.isRead && (params.targetsSensitiveData || params.targetsAdminApi)) {
    score = 2
  }

  if (params.targetsAdminApi && params.isRead) {
    score = Math.max(score, 3) as StealthLevel
  }

  if (params.isWrite) {
    score = Math.max(score, 4) as StealthLevel
  }

  if (params.isDelete || params.createsPeristence || params.isBulkOperation) {
    score = Math.max(score, 5) as StealthLevel
  }

  return score
}

/**
 * Get a CSS-compatible color class for a stealth level.
 */
export function getStealthColorClass(level: StealthLevel): {
  bg: string
  text: string
  border: string
  badge: string
} {
  const colors: Record<StealthLevel, { bg: string; text: string; border: string; badge: string }> = {
    1: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      badge: "bg-emerald-500/20 text-emerald-400",
    },
    2: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
      badge: "bg-sky-500/20 text-sky-400",
    },
    3: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      badge: "bg-amber-500/20 text-amber-400",
    },
    4: {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      border: "border-orange-500/30",
      badge: "bg-orange-500/20 text-orange-400",
    },
    5: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/30",
      badge: "bg-red-500/20 text-red-400",
    },
  }

  return colors[level]
}
