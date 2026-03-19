/**
 * Comprehensive scope definitions with descriptions and risk levels.
 * Used by the Scope Calculator and Token Analyzer.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical"

export interface ScopeDefinition {
  scope: string
  platform: "google" | "microsoft"
  name: string
  description: string
  risk: RiskLevel
  /** Whether this scope grants write/modify access */
  writeAccess: boolean
  /** Related service IDs */
  relatedServices: string[]
  /** Red team value */
  redTeamValue: string
}

export const SCOPE_DEFINITIONS: ScopeDefinition[] = [
  // --- Google Scopes ---
  {
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    platform: "google",
    name: "Gmail Read Only",
    description: "View email messages and settings.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["gmail"],
    redTeamValue: "Read all emails. Extract credentials, sensitive data, MFA codes.",
  },
  {
    scope: "https://www.googleapis.com/auth/gmail.modify",
    platform: "google",
    name: "Gmail Modify",
    description: "Read, modify, and manage email messages.",
    risk: "high",
    writeAccess: true,
    relatedServices: ["gmail"],
    redTeamValue: "Modify emails, delete evidence, manage labels to hide activity.",
  },
  {
    scope: "https://www.googleapis.com/auth/gmail.send",
    platform: "google",
    name: "Gmail Send",
    description: "Send email on behalf of the user.",
    risk: "high",
    writeAccess: true,
    relatedServices: ["gmail"],
    redTeamValue: "Send phishing emails from compromised account. High trust.",
  },
  {
    scope: "https://mail.google.com/",
    platform: "google",
    name: "Gmail Full Access",
    description: "Full access to Gmail including delete and permanent delete.",
    risk: "critical",
    writeAccess: true,
    relatedServices: ["gmail"],
    redTeamValue: "Complete mailbox control. Can permanently delete traces.",
  },
  {
    scope: "https://www.googleapis.com/auth/drive.readonly",
    platform: "google",
    name: "Drive Read Only",
    description: "View files in Google Drive.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["drive"],
    redTeamValue: "Browse and download all accessible files.",
  },
  {
    scope: "https://www.googleapis.com/auth/drive",
    platform: "google",
    name: "Drive Full Access",
    description: "Full access to Google Drive files.",
    risk: "critical",
    writeAccess: true,
    relatedServices: ["drive"],
    redTeamValue: "Read, modify, delete, and share any file. Full exfil capability.",
  },
  {
    scope: "https://www.googleapis.com/auth/drive.file",
    platform: "google",
    name: "Drive File Access",
    description: "Access files created or opened by the app.",
    risk: "low",
    writeAccess: true,
    relatedServices: ["drive"],
    redTeamValue: "Limited to files this app created. Low value alone.",
  },
  {
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    platform: "google",
    name: "Calendar Read Only",
    description: "View calendar events.",
    risk: "low",
    writeAccess: false,
    relatedServices: ["calendar"],
    redTeamValue: "Reconnaissance: meeting schedules, participants, locations.",
  },
  {
    scope: "https://www.googleapis.com/auth/calendar",
    platform: "google",
    name: "Calendar Full Access",
    description: "Full access to Google Calendar.",
    risk: "medium",
    writeAccess: true,
    relatedServices: ["calendar"],
    redTeamValue: "Create fake meeting invites for social engineering.",
  },
  {
    scope: "https://www.googleapis.com/auth/admin.directory.user.readonly",
    platform: "google",
    name: "Admin Directory Users (Read)",
    description: "View users in the organization.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["admin-directory"],
    redTeamValue: "Enumerate all users in the organization. Map org structure.",
  },
  {
    scope: "https://www.googleapis.com/auth/admin.directory.group.readonly",
    platform: "google",
    name: "Admin Directory Groups (Read)",
    description: "View groups in the organization.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["admin-directory"],
    redTeamValue: "Map security groups and membership.",
  },
  {
    scope: "https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly",
    platform: "google",
    name: "Admin Role Management (Read)",
    description: "View admin roles and assignments.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["admin-directory"],
    redTeamValue: "Identify all admin users and their privilege levels.",
  },
  {
    scope: "https://www.googleapis.com/auth/cloud-platform",
    platform: "google",
    name: "Cloud Platform (Full)",
    description: "Full access to all GCP resources.",
    risk: "critical",
    writeAccess: true,
    relatedServices: ["cloud-storage", "cloud-resource-manager", "iam"],
    redTeamValue: "God scope for GCP. Access everything. Create resources, exfil data.",
  },
  {
    scope: "https://www.googleapis.com/auth/cloud-platform.read-only",
    platform: "google",
    name: "Cloud Platform (Read Only)",
    description: "View GCP resources.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["cloud-storage", "cloud-resource-manager"],
    redTeamValue: "Read all GCP resources. Enumerate infrastructure.",
  },
  {
    scope: "https://www.googleapis.com/auth/devstorage.read_only",
    platform: "google",
    name: "Cloud Storage (Read Only)",
    description: "View objects in Google Cloud Storage.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["cloud-storage"],
    redTeamValue: "Read GCS bucket contents. Look for secrets, backups.",
  },
  {
    scope: "https://www.googleapis.com/auth/devstorage.read_write",
    platform: "google",
    name: "Cloud Storage (Read/Write)",
    description: "Manage objects in Google Cloud Storage.",
    risk: "high",
    writeAccess: true,
    relatedServices: ["cloud-storage"],
    redTeamValue: "Read and modify GCS objects. Plant backdoors in storage.",
  },
  {
    scope: "https://www.googleapis.com/auth/iam",
    platform: "google",
    name: "IAM Management",
    description: "Manage IAM policies and service accounts.",
    risk: "critical",
    writeAccess: true,
    relatedServices: ["iam"],
    redTeamValue: "Create SA keys, impersonate accounts. Ultimate persistence.",
  },
  {
    scope: "https://www.googleapis.com/auth/contacts.readonly",
    platform: "google",
    name: "Contacts Read Only",
    description: "View contacts.",
    risk: "low",
    writeAccess: false,
    relatedServices: ["people"],
    redTeamValue: "Harvest contact information for targeted phishing.",
  },
  {
    scope: "https://www.googleapis.com/auth/directory.readonly",
    platform: "google",
    name: "Directory Read Only",
    description: "View organization directory.",
    risk: "low",
    writeAccess: false,
    relatedServices: ["people"],
    redTeamValue: "Enumerate org directory entries.",
  },

  // --- Microsoft Scopes ---
  {
    scope: "Mail.Read",
    platform: "microsoft",
    name: "Mail Read",
    description: "Read user mail.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["mail"],
    redTeamValue: "Read all emails. Extract credentials, sensitive data.",
  },
  {
    scope: "Mail.ReadWrite",
    platform: "microsoft",
    name: "Mail Read/Write",
    description: "Read and write user mail.",
    risk: "high",
    writeAccess: true,
    relatedServices: ["mail"],
    redTeamValue: "Modify and delete emails. Hide evidence.",
  },
  {
    scope: "Mail.Send",
    platform: "microsoft",
    name: "Mail Send",
    description: "Send mail as the user.",
    risk: "high",
    writeAccess: true,
    relatedServices: ["mail"],
    redTeamValue: "Send phishing emails from trusted account.",
  },
  {
    scope: "Files.Read",
    platform: "microsoft",
    name: "Files Read",
    description: "Read user files.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["onedrive"],
    redTeamValue: "Browse and download OneDrive files.",
  },
  {
    scope: "Files.ReadWrite",
    platform: "microsoft",
    name: "Files Read/Write",
    description: "Read and write user files.",
    risk: "high",
    writeAccess: true,
    relatedServices: ["onedrive"],
    redTeamValue: "Full file access. Exfiltrate and modify documents.",
  },
  {
    scope: "Files.ReadWrite.All",
    platform: "microsoft",
    name: "Files Read/Write All",
    description: "Read and write all files the user can access.",
    risk: "critical",
    writeAccess: true,
    relatedServices: ["onedrive", "sharepoint"],
    redTeamValue: "Access all files across OneDrive and SharePoint.",
  },
  {
    scope: "Sites.Read.All",
    platform: "microsoft",
    name: "SharePoint Sites Read",
    description: "Read items in all site collections.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["sharepoint"],
    redTeamValue: "Browse all SharePoint sites and document libraries.",
  },
  {
    scope: "Sites.ReadWrite.All",
    platform: "microsoft",
    name: "SharePoint Sites Read/Write",
    description: "Read and write items in all site collections.",
    risk: "critical",
    writeAccess: true,
    relatedServices: ["sharepoint"],
    redTeamValue: "Full SharePoint access. Modify team documents.",
  },
  {
    scope: "User.Read",
    platform: "microsoft",
    name: "User Profile Read",
    description: "Read the signed-in user's profile.",
    risk: "low",
    writeAccess: false,
    relatedServices: ["directory"],
    redTeamValue: "Basic user info. Low value alone.",
  },
  {
    scope: "User.Read.All",
    platform: "microsoft",
    name: "All Users Read",
    description: "Read all users' full profiles.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["directory"],
    redTeamValue: "Enumerate all tenant users and their attributes.",
  },
  {
    scope: "Group.Read.All",
    platform: "microsoft",
    name: "Groups Read",
    description: "Read all groups.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["directory"],
    redTeamValue: "Map security groups and membership.",
  },
  {
    scope: "Directory.Read.All",
    platform: "microsoft",
    name: "Directory Read All",
    description: "Read all directory data.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["directory"],
    redTeamValue: "Full directory enumeration. Apps, SPs, roles.",
  },
  {
    scope: "RoleManagement.Read.Directory",
    platform: "microsoft",
    name: "Role Management Read",
    description: "Read role management data for Azure AD.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["directory"],
    redTeamValue: "Find Global Admins and privileged role holders.",
  },
  {
    scope: "Policy.Read.All",
    platform: "microsoft",
    name: "Policies Read",
    description: "Read all organization policies.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["conditional-access"],
    redTeamValue: "Read Conditional Access policies to find evasion paths.",
  },
  {
    scope: "Team.ReadBasic.All",
    platform: "microsoft",
    name: "Teams Read Basic",
    description: "Read basic team info.",
    risk: "low",
    writeAccess: false,
    relatedServices: ["teams"],
    redTeamValue: "Enumerate Teams membership.",
  },
  {
    scope: "Chat.Read",
    platform: "microsoft",
    name: "Chat Read",
    description: "Read user chat messages.",
    risk: "high",
    writeAccess: false,
    relatedServices: ["teams"],
    redTeamValue: "Access private chat messages. High intel value.",
  },
  {
    scope: "ChannelMessage.Read.All",
    platform: "microsoft",
    name: "Channel Messages Read",
    description: "Read all channel messages.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["teams"],
    redTeamValue: "Read Teams channel conversations.",
  },
  {
    scope: "DeviceManagementManagedDevices.Read.All",
    platform: "microsoft",
    name: "Intune Devices Read",
    description: "Read managed device properties.",
    risk: "medium",
    writeAccess: false,
    relatedServices: ["intune"],
    redTeamValue: "Enumerate corporate devices managed by Intune.",
  },
]

/**
 * Look up a scope definition.
 */
export function getScopeDefinition(scope: string): ScopeDefinition | undefined {
  return SCOPE_DEFINITIONS.find((s) => s.scope === scope)
}

/**
 * Get all scopes for a specific platform.
 */
export function getScopesByPlatform(platform: "google" | "microsoft"): ScopeDefinition[] {
  return SCOPE_DEFINITIONS.filter((s) => s.platform === platform)
}

/**
 * Get all scopes at a specific risk level.
 */
export function getScopesByRisk(risk: RiskLevel): ScopeDefinition[] {
  return SCOPE_DEFINITIONS.filter((s) => s.risk === risk)
}

/**
 * Analyze a list of scopes and return their definitions with risk summary.
 */
export function analyzeScopes(scopes: string[]): {
  found: ScopeDefinition[]
  unknown: string[]
  riskSummary: Record<RiskLevel, number>
  maxRisk: RiskLevel
  hasWriteAccess: boolean
} {
  const found: ScopeDefinition[] = []
  const unknown: string[] = []

  for (const scope of scopes) {
    const def = getScopeDefinition(scope)
    if (def) {
      found.push(def)
    } else {
      unknown.push(scope)
    }
  }

  const riskSummary: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 }
  for (const def of found) {
    riskSummary[def.risk]++
  }

  const riskOrder: RiskLevel[] = ["critical", "high", "medium", "low"]
  const maxRisk = riskOrder.find((r) => riskSummary[r] > 0) ?? "low"
  const hasWriteAccess = found.some((d) => d.writeAccess)

  return { found, unknown, riskSummary, maxRisk, hasWriteAccess }
}
