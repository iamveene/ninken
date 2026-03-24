import {
  minimalAccessToken,
  type AccessTokenCredential,
  type BaseCredential,
  type GoogleCredential,
  type GoogleServiceAccountCredential,
  type ServiceProvider,
} from "./types"
import type { CredentialStrategy } from "./credential-strategy"
import { googleOAuthStrategy } from "./strategies/google-oauth"
import { googleServiceAccountStrategy } from "./strategies/google-service-account"
import {
  detectGoogleAccessToken,
  validateGoogleAccessToken,
} from "./strategies/google-access-token"

const strategies: CredentialStrategy[] = [
  googleOAuthStrategy,
  googleServiceAccountStrategy,
]

function strategyForKind(credential: BaseCredential) {
  return strategies.find((s) => s.kind === credential.credentialKind)
}

export const googleProvider: ServiceProvider = {
  id: "google",
  name: "Google Workspace",
  description: "Gmail, Drive, Calendar, GCP Buckets, Directory",
  iconName: "Globe",

  detectCredential(raw: unknown): boolean {
    // Raw access token string (ya29.* prefix)
    if (detectGoogleAccessToken(raw)) return true
    return strategies.some((s) => s.detect(raw))
  },

  validateCredential(
    raw: unknown,
  ):
    | { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string } {
    // Raw access token string
    if (typeof raw === "string" && detectGoogleAccessToken(raw)) {
      return validateGoogleAccessToken(raw)
    }
    const strategy = strategies.find((s) => s.detect(raw))
    if (!strategy) {
      return { valid: false, error: "Unrecognized Google credential format" }
    }
    return strategy.validate(raw)
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    // Access token credentials: return stored token directly
    if (credential.credentialKind === "access-token") {
      return (credential as AccessTokenCredential).access_token
    }
    const strategy = strategyForKind(credential)
    if (!strategy) {
      throw new Error(
        `No Google strategy for credential kind: ${credential.credentialKind}`,
      )
    }
    return strategy.getAccessToken(credential)
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    const accessToken = await this.getAccessToken(credential)
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/tokeninfo",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `access_token=${accessToken}` },
    )
    if (!res.ok) return []
    const info = await res.json()
    const scopeString: string = info.scope || ""
    return scopeString.split(" ").filter(Boolean)
  },

  emailEndpoint: "/api/gmail/profile",

  operateNavItems: [
    { id: "gmail", title: "Gmail", href: "/gmail", iconName: "Mail" },
    { id: "drive", title: "Drive", href: "/drive", iconName: "HardDrive" },
    { id: "buckets", title: "Buckets", href: "/buckets", iconName: "Database" },
    { id: "calendar", title: "Calendar", href: "/calendar", iconName: "Calendar" },
    { id: "directory", title: "Directory", href: "/directory", iconName: "Users" },
    { id: "chat", title: "Chat", href: "/chat", iconName: "MessageCircle" },
  ],

  serviceSubNav: {
    gmail: [
      { id: "gmail-inbox", title: "Inbox", href: "/gmail", iconName: "Inbox" },
      { id: "gmail-starred", title: "Starred", href: "/gmail?label=STARRED", iconName: "Star" },
      { id: "gmail-sent", title: "Sent", href: "/gmail?label=SENT", iconName: "Send" },
      { id: "gmail-drafts", title: "Drafts", href: "/gmail?label=DRAFT", iconName: "FileEdit" },
      { id: "gmail-spam", title: "Spam", href: "/gmail?label=SPAM", iconName: "AlertTriangle" },
      { id: "gmail-trash", title: "Trash", href: "/gmail?label=TRASH", iconName: "Trash2" },
    ],
    drive: [
      { id: "drive-my", title: "My Drive", href: "/drive", iconName: "FolderOpen" },
      { id: "drive-shared", title: "Shared Drives", href: "/drive?view=shared", iconName: "FolderSync" },
      { id: "drive-recent", title: "Recent", href: "/drive?view=recent", iconName: "Clock" },
      { id: "drive-starred", title: "Starred", href: "/drive?view=starred", iconName: "Star" },
    ],
    calendar: [
      { id: "calendar-main", title: "Calendar", href: "/calendar", iconName: "Calendar" },
    ],
    directory: [
      { id: "directory-users", title: "People", href: "/directory", iconName: "Users" },
      { id: "directory-groups", title: "Groups", href: "/directory?tab=groups", iconName: "UsersRound" },
    ],
    chat: [
      { id: "chat-spaces", title: "Spaces", href: "/chat", iconName: "MessageCircle" },
    ],
    buckets: [
      { id: "buckets-main", title: "Cloud Storage", href: "/buckets", iconName: "Database" },
    ],
  },

  auditNavItems: [
    { id: "audit-dashboard", title: "Dashboard", href: "/audit", iconName: "LayoutDashboard" },
    { id: "audit-users", title: "Users", href: "/audit/users", iconName: "Users" },
    { id: "audit-groups", title: "Groups", href: "/audit/groups", iconName: "UsersRound" },
    { id: "audit-roles", title: "Roles", href: "/audit/roles", iconName: "ShieldCheck" },
    { id: "audit-apps", title: "Apps", href: "/audit/apps", iconName: "AppWindow" },
    { id: "audit-delegation", title: "Delegation", href: "/audit/delegation", iconName: "KeyRound" },
    { id: "audit-devices", title: "Devices", href: "/audit/devices", iconName: "Smartphone" },
    { id: "audit-policies", title: "Policies", href: "/audit/policies", iconName: "Settings" },
    { id: "audit-marketplace", title: "Marketplace", href: "/audit/marketplace", iconName: "Store" },
    { id: "audit-access", title: "Access Policies", href: "/audit/access-policies", iconName: "ShieldAlert" },
    { id: "audit-groups-settings", title: "Groups Settings", href: "/audit/groups-settings", iconName: "Settings2" },
    { id: "audit-contacts", title: "Contacts", href: "/audit/contacts", iconName: "ContactRound" },
    { id: "audit-reports", title: "Admin Reports", href: "/audit/admin-reports", iconName: "FileText" },
    { id: "audit-alert-center", title: "Alert Center", href: "/audit/alert-center", iconName: "Bell" },
    { id: "audit-drive-activity", title: "Drive Activity", href: "/audit/drive-activity", iconName: "Activity" },
  ],

  exploreNavGroups: [
    {
      label: "Audit",
      items: [
        { id: "audit-dashboard", title: "Dashboard", href: "/audit", iconName: "LayoutDashboard" },
        { id: "audit-users", title: "Users", href: "/audit/users", iconName: "Users" },
        { id: "audit-groups", title: "Groups", href: "/audit/groups", iconName: "UsersRound" },
        { id: "audit-roles", title: "Roles", href: "/audit/roles", iconName: "ShieldCheck" },
        { id: "audit-apps", title: "Apps", href: "/audit/apps", iconName: "AppWindow" },
        { id: "audit-delegation", title: "Delegation", href: "/audit/delegation", iconName: "KeyRound" },
        { id: "audit-devices", title: "Devices", href: "/audit/devices", iconName: "Smartphone" },
        { id: "audit-policies", title: "Policies", href: "/audit/policies", iconName: "Settings" },
        { id: "audit-marketplace", title: "Marketplace", href: "/audit/marketplace", iconName: "Store" },
        { id: "audit-access", title: "Access Policies", href: "/audit/access-policies", iconName: "ShieldAlert" },
        { id: "audit-groups-settings", title: "Groups Settings", href: "/audit/groups-settings", iconName: "Settings2" },
        { id: "audit-contacts", title: "Contacts", href: "/audit/contacts", iconName: "ContactRound" },
        { id: "audit-reports", title: "Admin Reports", href: "/audit/admin-reports", iconName: "FileText" },
        { id: "audit-alert-center", title: "Alert Center", href: "/audit/alert-center", iconName: "Bell" },
        { id: "audit-drive-activity", title: "Drive Activity", href: "/audit/drive-activity", iconName: "Activity" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { id: "audit-hunt", title: "Hunt", href: "/audit/hunt", iconName: "Crosshair" },
        { id: "explore-graphs", title: "Adversarial Graphs", href: "/explore/graphs", iconName: "Share2" },
      ],
    },
  ],

  scopeAppMap: {
    gmail: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://mail.google.com/",
    ],
    drive: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ],
    buckets: [
      "https://www.googleapis.com/auth/devstorage.full_control",
      "https://www.googleapis.com/auth/devstorage.read_write",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
    calendar: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
    directory: [
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
      "https://www.googleapis.com/auth/admin.directory.user",
      "https://www.googleapis.com/auth/admin.directory.group.readonly",
      "https://www.googleapis.com/auth/admin.directory.group",
    ],
    chat: [
      "https://www.googleapis.com/auth/chat.messages.readonly",
      "https://www.googleapis.com/auth/chat.messages",
      "https://www.googleapis.com/auth/chat.spaces.readonly",
      "https://www.googleapis.com/auth/chat.spaces",
    ],
    "admin-reports": [
      "https://www.googleapis.com/auth/admin.reports.audit.readonly",
      "https://www.googleapis.com/auth/admin.reports.usage.readonly",
    ],
    "alert-center": [
      "https://www.googleapis.com/auth/apps.alerts",
      "https://www.googleapis.com/auth/apps.alerts.readonly",
    ],
    "drive-activity": [
      "https://www.googleapis.com/auth/drive.activity.readonly",
      "https://www.googleapis.com/auth/drive.activity",
    ],
    "groups-settings": [
      "https://www.googleapis.com/auth/apps.groups.settings",
    ],
    contacts: [
      "https://www.googleapis.com/auth/contacts.readonly",
      "https://www.googleapis.com/auth/contacts.other.readonly",
      "https://www.googleapis.com/auth/directory.readonly",
    ],
  },

  parseApiError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== "object") return null

    if ("code" in error) {
      const apiError = error as { code: number; message?: string }
      const status = apiError.code
      if (status >= 400 && status < 600) {
        return { status, message: apiError.message || "Request failed" }
      }
    }

    const err = error as {
      errors?: { message?: string; reason?: string }[]
      message?: string
    }
    if (Array.isArray(err.errors) && err.errors.length > 0) {
      const msg = err.errors[0].message || err.message || "Request failed"
      const isInvalid =
        msg.toLowerCase().includes("invalid") ||
        err.errors[0].reason === "notFound"
      return { status: isInvalid ? 400 : 500, message: msg }
    }

    if (err.message && /\binvalid\b/i.test(err.message)) {
      return { status: 400, message: err.message }
    }

    return null
  },

  canRefresh(credential: BaseCredential): boolean {
    if (credential.credentialKind === "access-token") return false
    const strategy = strategyForKind(credential)
    if (!strategy) return false
    return strategy.canRefresh(credential)
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    if (credential.credentialKind === "access-token") {
      return minimalAccessToken(credential as AccessTokenCredential)
    }
    const strategy = strategyForKind(credential)
    if (strategy) return strategy.minimalCredential(credential)
    // Fallback: handle service-account explicitly
    if (credential.credentialKind === "service-account") {
      const sa = credential as GoogleServiceAccountCredential
      return {
        provider: "google",
        credentialKind: "service-account",
        client_email: sa.client_email,
        private_key: sa.private_key,
        private_key_id: sa.private_key_id,
        project_id: sa.project_id,
        token_uri: sa.token_uri,
      } as GoogleServiceAccountCredential
    }
    const c = credential as GoogleCredential
    return {
      provider: "google",
      credentialKind: c.credentialKind,
      refresh_token: c.refresh_token,
      client_id: c.client_id,
      client_secret: c.client_secret,
      token_uri: c.token_uri,
    } as GoogleCredential
  },

  defaultRoute: "/dashboard",
}
