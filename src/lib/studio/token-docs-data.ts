export type RefreshCapability = "server" | "browser-only" | "none"

export interface TokenTypeEntry {
  id: string
  tokenType: string
  clientId: string
  credentialKind: string
  serverRefresh: RefreshCapability
  refreshLabel: string
  foci: boolean
  keyScopes: string
  limitations: string
  detailedScopes?: string[]
}

export const TOKEN_TYPES: TokenTypeEntry[] = [
  {
    id: "oauth",
    tokenType: "OAuth Refresh",
    clientId: "Various",
    credentialKind: "oauth",
    serverRefresh: "server",
    refreshLabel: "YES",
    foci: false,
    keyScopes: "Varies by client",
    limitations: "Standard flow",
  },
  {
    id: "foci",
    tokenType: "FOCI Token",
    clientId: "Teams/Office",
    credentialKind: "foci",
    serverRefresh: "server",
    refreshLabel: "YES",
    foci: true,
    keyScopes: "Cross-app exchange",
    limitations: "Requires FOCI-enrolled client",
  },
  {
    id: "service-principal",
    tokenType: "Service Principal",
    clientId: "App-specific",
    credentialKind: "service-principal",
    serverRefresh: "server",
    refreshLabel: "YES (client_credentials)",
    foci: false,
    keyScopes: "App permissions",
    limitations: "No user context",
  },
  {
    id: "prt",
    tokenType: "PRT",
    clientId: "Windows device",
    credentialKind: "prt",
    serverRefresh: "server",
    refreshLabel: "YES (HMAC assertion)",
    foci: false,
    keyScopes: "Full SSO",
    limitations: "Requires session_key",
  },
  {
    id: "prt-cookie",
    tokenType: "PRT Cookie",
    clientId: "Browser",
    credentialKind: "prt-cookie",
    serverRefresh: "none",
    refreshLabel: "NO (one-shot)",
    foci: false,
    keyScopes: "Code → token exchange",
    limitations: "Single use",
  },
  {
    id: "browser-session",
    tokenType: "Browser Session",
    clientId: "ESTSAUTHPERSISTENT",
    credentialKind: "browser-session",
    serverRefresh: "none",
    refreshLabel: "NO",
    foci: false,
    keyScopes: "Code → token exchange",
    limitations: "Single use",
  },
  {
    id: "access-token",
    tokenType: "Access Token",
    clientId: "Any",
    credentialKind: "access-token",
    serverRefresh: "none",
    refreshLabel: "NO",
    foci: false,
    keyScopes: "Decoded from JWT scp",
    limitations: "Expires ~1hr",
  },
  {
    id: "spa-owa",
    tokenType: "SPA Token (OWA)",
    clientId: "9199bf20",
    credentialKind: "spa",
    serverRefresh: "browser-only",
    refreshLabel: "BROWSER ONLY",
    foci: false,
    keyScopes: "26 Graph scopes (no Mail)",
    limitations: "Origin-bound, ~1hr AT",
    detailedScopes: [
      "Calendars.ReadWrite",
      "Chat.Create",
      "Chat.ReadWrite",
      "Contacts.ReadWrite",
      "Directory.Read.All",
      "Files.ReadWrite.All",
      "Group.ReadWrite.All",
      "MailboxSettings.ReadWrite",
      "OnlineMeetings.ReadWrite",
      "Organization.Read.All",
      "People.Read",
      "Presence.Read.All",
      "Sites.Read.All",
      "Team.ReadBasic.All",
      "TeamSettings.ReadWrite.All",
      "User.Read",
      "User.Read.All",
      "User.ReadBasic.All",
      "User.ReadWrite",
      "UserActivity.ReadWrite.CreatedByApp",
    ],
  },
  {
    id: "spa-teams",
    tokenType: "SPA Token (Teams)",
    clientId: "5e3ce6c0",
    credentialKind: "spa",
    serverRefresh: "browser-only",
    refreshLabel: "BROWSER ONLY",
    foci: false,
    keyScopes: "30 Graph scopes (Mail, Calendar, SharePoint)",
    limitations: "Origin-bound, ~1hr AT",
    detailedScopes: [
      "Calendars.ReadWrite",
      "Chat.Create",
      "Chat.ReadWrite",
      "Contacts.ReadWrite",
      "Directory.Read.All",
      "Files.ReadWrite.All",
      "Group.ReadWrite.All",
      "Mail.Read",
      "Mail.ReadWrite",
      "Mail.Send",
      "MailboxSettings.ReadWrite",
      "Notes.ReadWrite",
      "OnlineMeetings.ReadWrite",
      "Organization.Read.All",
      "People.Read",
      "Presence.Read.All",
      "Sites.Read.All",
      "Sites.ReadWrite.All",
      "Tasks.ReadWrite",
      "Team.ReadBasic.All",
      "TeamSettings.ReadWrite.All",
      "User.Read",
      "User.Read.All",
      "User.ReadBasic.All",
      "User.ReadWrite",
      "UserActivity.ReadWrite.CreatedByApp",
    ],
  },
]

export interface ScopeComparison {
  scope: string
  owa: boolean
  teams: boolean
}

function buildScopeComparisons(): ScopeComparison[] {
  const owa = TOKEN_TYPES.find((t) => t.id === "spa-owa")
  const teams = TOKEN_TYPES.find((t) => t.id === "spa-teams")
  const owaScopes = new Set(owa?.detailedScopes ?? [])
  const teamsScopes = new Set(teams?.detailedScopes ?? [])
  const allScopes = Array.from(new Set([...owaScopes, ...teamsScopes])).sort()
  return allScopes.map((scope) => ({
    scope,
    owa: owaScopes.has(scope),
    teams: teamsScopes.has(scope),
  }))
}

export const SCOPE_COMPARISONS: ScopeComparison[] = buildScopeComparisons()

export const KQL_QUERIES = [
  {
    title: "Detect SPA token usage from unusual sources",
    query: `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where ResourceDisplayName != "Microsoft Graph"
| project TimeGenerated, UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress`,
  },
  {
    title: "Detect token refresh from non-standard IPs",
    query: `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where IPAddress !in (known_corporate_ips)
| summarize count() by UserPrincipalName, IPAddress, AppDisplayName`,
  },
  {
    title: "Monitor for suspicious resource access patterns",
    query: `AADServicePrincipalSignInLogs
| where ResourceDisplayName != "Microsoft Graph"
| where ServicePrincipalName in ("One Outlook Web", "Microsoft Teams Web Client")`,
  },
]

export const MITIGATIONS = [
  {
    title: "Token Protection (Token Binding)",
    description:
      "Binds tokens cryptographically to the device that requested them, preventing export and replay from other machines.",
  },
  {
    title: "Continuous Access Evaluation (CAE)",
    description:
      "Enables real-time token revocation by pushing critical events (password change, user disable, IP change) to resource providers within minutes instead of waiting for token expiry.",
  },
  {
    title: "Device Compliance Policies",
    description:
      "Require Intune-managed, compliant devices for token issuance. Blocks token acquisition from unmanaged endpoints.",
  },
  {
    title: "Conditional Access — Block SPA-Only Flows",
    description:
      "Create CA policies that restrict browser-based SPA authentication to approved locations, devices, or risk levels.",
  },
  {
    title: "MSAL Cache Encryption",
    description:
      "Enable DPAPI/Keychain encryption for MSAL token caches. Prevents plaintext token extraction from localStorage and filesystem caches.",
  },
]
