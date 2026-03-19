import type {
  BaseCredential,
  GoogleCredential,
  ServiceProvider,
} from "./types"

function isGoogleShape(obj: Record<string, unknown>): boolean {
  // Must have the three required OAuth fields
  if (
    typeof obj.refresh_token !== "string" || !obj.refresh_token ||
    typeof obj.client_id !== "string" || !obj.client_id ||
    typeof obj.client_secret !== "string" || !obj.client_secret
  ) {
    return false
  }

  // Positive discriminator: if token_uri is present, it must be Google's
  const tokenUri = typeof obj.token_uri === "string" ? obj.token_uri : ""
  if (tokenUri && !tokenUri.includes("googleapis.com") && !tokenUri.includes("accounts.google.com")) {
    return false
  }

  // Negative discriminator: reject if Microsoft-specific fields are present
  if ("tenant_id" in obj || "tenantId" in obj) return false

  return true
}

export const googleProvider: ServiceProvider = {
  id: "google",
  name: "Google Workspace",
  description: "Gmail, Drive, Calendar, GCP Buckets, Directory",
  iconName: "Globe",

  detectCredential(raw: unknown): boolean {
    if (!raw || typeof raw !== "object") return false
    return isGoogleShape(raw as Record<string, unknown>)
  },

  validateCredential(
    raw: unknown
  ):
    | { valid: true; credential: GoogleCredential; email?: string }
    | { valid: false; error: string } {
    if (!raw || typeof raw !== "object") {
      return { valid: false, error: "Invalid JSON" }
    }

    const obj = raw as Record<string, unknown>
    const requiredFields = ["refresh_token", "client_id", "client_secret"] as const

    for (const field of requiredFields) {
      if (typeof obj[field] !== "string" || !obj[field]) {
        return { valid: false, error: `Missing required field: ${field}` }
      }
    }

    const credential: GoogleCredential = {
      provider: "google",
      credentialKind: "oauth",
      refresh_token: obj.refresh_token as string,
      client_id: obj.client_id as string,
      client_secret: obj.client_secret as string,
      token: typeof obj.token === "string" ? obj.token : undefined,
      token_uri: typeof obj.token_uri === "string" ? obj.token_uri : undefined,
    }

    const email = typeof obj.email === "string" ? obj.email : undefined

    return { valid: true, credential, email }
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    // Uses raw fetch to avoid importing google-auth-library in client bundles
    const cred = credential as GoogleCredential
    const tokenUri = cred.token_uri || "https://oauth2.googleapis.com/token"
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: cred.refresh_token,
        client_id: cred.client_id,
        client_secret: cred.client_secret,
      }),
    })
    if (!res.ok) throw new Error("Failed to refresh Google access token")
    const data = await res.json()
    if (!data.access_token) throw new Error("No access_token in refresh response")
    return data.access_token as string
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    const accessToken = await this.getAccessToken(credential)
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
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
    { id: "audit-query", title: "Query", href: "/audit/query", iconName: "Search" },
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
    "groups-settings": [
      "https://www.googleapis.com/auth/apps.groups.settings",
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
    return credential.credentialKind !== "access-token"
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
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
