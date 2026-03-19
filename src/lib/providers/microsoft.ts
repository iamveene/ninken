import type {
  BaseCredential,
  MicrosoftCredential,
  ServiceProvider,
} from "./types"
import {
  getAccessToken as msGetAccessToken,
  decodeJwtPayload,
  decodeScopesFromJwt,
} from "../microsoft"

// Teams FOCI client ID (public client, no secret needed)
const TEAMS_FOCI_CLIENT_ID = "1fec8e78-bce4-4aaf-ab1b-5451cc387264"

function isMicrosoftShape(obj: Record<string, unknown>): boolean {
  // Explicit platform marker
  if (obj.platform === "microsoft" || obj.provider === "microsoft") return true

  const hasTenantId =
    typeof obj.tenant_id === "string" ||
    typeof obj.tenantId === "string"

  // Service principal: has client_secret + tenant_id (no refresh_token needed)
  if (typeof obj.client_secret === "string" && obj.client_secret && hasTenantId) {
    return true
  }

  // Must have refresh_token for remaining checks
  if (typeof obj.refresh_token !== "string" || !obj.refresh_token) return false

  // Positive: has tenant_id
  if (hasTenantId) return true

  // Positive: token_uri contains Microsoft endpoint
  const tokenUri = typeof obj.token_uri === "string" ? obj.token_uri : ""
  if (tokenUri.includes("login.microsoftonline.com")) return true

  return false
}

/**
 * Normalize the raw credential JSON, handling various formats:
 * - Direct: { refresh_token, client_id, tenant_id, ... }
 * - Richter token: { accessToken, refreshToken, tenantId, clientId, ... }
 * - Nested: { token: { refresh_token, ... }, tenant_id, ... }
 */
function normalizeRaw(raw: Record<string, unknown>): Record<string, unknown> {
  // Richter / camelCase format
  if (typeof raw.refreshToken === "string") {
    return {
      refresh_token: raw.refreshToken,
      client_id: raw.clientId || raw.client_id || TEAMS_FOCI_CLIENT_ID,
      tenant_id: raw.tenantId || raw.tenant_id,
      access_token: raw.accessToken || raw.access_token,
      scope: raw.scope,
      foci: raw.foci,
      account: raw.account || raw.userId || raw.userPrincipalName,
    }
  }

  // Nested token format
  if (raw.token && typeof raw.token === "object") {
    const inner = raw.token as Record<string, unknown>
    return {
      ...inner,
      tenant_id: inner.tenant_id || raw.tenant_id || raw.tenantId,
      client_id: inner.client_id || raw.client_id || TEAMS_FOCI_CLIENT_ID,
    }
  }

  // Azure CLI MSAL cache: { AccessToken: {...}, RefreshToken: {...}, Account: {...}, ... }
  if (raw.RefreshToken && typeof raw.RefreshToken === "object") {
    const rtEntries = Object.values(raw.RefreshToken as Record<string, Record<string, unknown>>)
    if (rtEntries.length > 0) {
      const first = rtEntries[0]
      return {
        refresh_token: first.secret as string,
        client_id: (first.client_id as string) || TEAMS_FOCI_CLIENT_ID,
        tenant_id: (first.realm as string) || (first.environment as string),
        foci: first.family_id === "1",
        account: first.username as string,
      }
    }
  }

  // Azure PowerShell: { Contexts: { "Default": { Account: { Id, Tenants }, ... } } }
  if (raw.Contexts && typeof raw.Contexts === "object") {
    const contexts = raw.Contexts as Record<string, Record<string, unknown>>
    const firstKey = Object.keys(contexts)[0]
    if (firstKey) {
      const ctx = contexts[firstKey]
      const account = ctx.Account as Record<string, unknown> | undefined
      const tenant = (account?.Tenants as string[])?.[0] || ""
      return {
        provider: "microsoft",
        tenant_id: tenant,
        client_id: TEAMS_FOCI_CLIENT_ID,
        refresh_token: "",
        account: account?.Id as string,
      }
    }
  }

  // Service principal: { client_id, client_secret, tenant_id }
  if (
    typeof raw.client_secret === "string" && raw.client_secret &&
    typeof raw.client_id === "string" && raw.client_id &&
    (typeof raw.tenant_id === "string" || typeof raw.tenantId === "string")
  ) {
    return {
      ...raw,
      tenant_id: (raw.tenant_id || raw.tenantId) as string,
    }
  }

  return raw
}

export const microsoftProvider: ServiceProvider = {
  id: "microsoft",
  name: "Microsoft 365",
  description: "Outlook, OneDrive, Teams, Entra ID",
  iconName: "Monitor",

  detectCredential(raw: unknown): boolean {
    // Raw JWT string: check for Microsoft-specific claims
    if (typeof raw === "string" && raw.startsWith("eyJ")) {
      const payload = decodeJwtPayload(raw)
      if (payload) {
        return !!(payload.tid || (typeof payload.iss === "string" && payload.iss.includes("sts.windows.net")))
      }
      return false
    }
    if (!raw || typeof raw !== "object") return false
    const obj = normalizeRaw(raw as Record<string, unknown>)
    return isMicrosoftShape(obj)
  },

  validateCredential(
    raw: unknown
  ):
    | { valid: true; credential: MicrosoftCredential; email?: string }
    | { valid: false; error: string } {
    if (!raw || typeof raw !== "object") {
      return { valid: false, error: "Invalid JSON" }
    }

    const obj = normalizeRaw(raw as Record<string, unknown>)

    if (typeof obj.refresh_token !== "string" || !obj.refresh_token) {
      return { valid: false, error: "Missing required field: refresh_token" }
    }

    // tenant_id is required
    const tenantId = (obj.tenant_id || obj.tenantId) as string | undefined
    if (!tenantId) {
      return { valid: false, error: "Missing required field: tenant_id" }
    }

    // Default client_id to Teams FOCI if not provided
    const clientId =
      typeof obj.client_id === "string" && obj.client_id
        ? obj.client_id
        : TEAMS_FOCI_CLIENT_ID

    const isFoci = obj.foci === true || obj.foci === "1"

    const credential: MicrosoftCredential = {
      provider: "microsoft",
      credentialKind: isFoci ? "foci" : "oauth",
      refresh_token: obj.refresh_token as string,
      client_id: clientId,
      tenant_id: tenantId,
      access_token:
        typeof obj.access_token === "string" ? obj.access_token : undefined,
      scope: Array.isArray(obj.scope)
        ? (obj.scope as string[])
        : typeof obj.scope === "string"
          ? (obj.scope as string).split(" ").filter(Boolean)
          : undefined,
      token_uri:
        typeof obj.token_uri === "string" ? obj.token_uri : undefined,
      account:
        typeof obj.account === "string" ? obj.account : undefined,
      foci: isFoci,
    }

    const email =
      typeof obj.email === "string"
        ? obj.email
        : typeof obj.account === "string"
          ? obj.account
          : undefined

    return { valid: true, credential, email }
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    return msGetAccessToken(credential as MicrosoftCredential)
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    const accessToken = await this.getAccessToken(credential)
    return decodeScopesFromJwt(accessToken)
  },

  emailEndpoint: "/api/microsoft/me",
  defaultRoute: "/outlook",

  operateNavItems: [
    { id: "outlook", title: "Outlook", href: "/outlook", iconName: "Mail" },
    { id: "onedrive", title: "OneDrive", href: "/onedrive", iconName: "HardDrive" },
    { id: "teams", title: "Teams", href: "/teams", iconName: "MessageSquare" },
    { id: "entra", title: "Entra ID", href: "/entra", iconName: "Users" },
  ],

  auditNavItems: [
    { id: "m365-audit-dashboard", title: "Dashboard", href: "/m365-audit", iconName: "LayoutDashboard" },
    { id: "m365-audit-users", title: "Users", href: "/m365-audit/users", iconName: "Users" },
    { id: "m365-audit-groups", title: "Groups", href: "/m365-audit/groups", iconName: "UsersRound" },
    { id: "m365-audit-roles", title: "Roles", href: "/m365-audit/roles", iconName: "ShieldCheck" },
    { id: "m365-audit-apps", title: "Apps", href: "/m365-audit/apps", iconName: "AppWindow" },
    { id: "m365-audit-signins", title: "Sign-ins", href: "/m365-audit/sign-ins", iconName: "LogIn" },
    { id: "m365-audit-risky", title: "Risky Users", href: "/m365-audit/risky-users", iconName: "AlertTriangle" },
    { id: "m365-audit-ca", title: "Conditional Access", href: "/m365-audit/conditional-access", iconName: "Shield" },
    { id: "m365-audit-query", title: "Query", href: "/m365-audit/query", iconName: "Search" },
  ],

  scopeAppMap: {
    outlook: [
      "Mail.Read",
      "Mail.ReadWrite",
      "Mail.Send",
      "Mail.ReadBasic",
    ],
    onedrive: [
      "Files.Read",
      "Files.Read.All",
      "Files.ReadWrite",
      "Files.ReadWrite.All",
    ],
    teams: [
      "Team.ReadBasic.All",
      "Channel.ReadBasic.All",
      "ChannelMessage.Read.All",
    ],
    entra: [
      "User.ReadBasic.All",
      "User.Read.All",
      "Directory.Read.All",
      "GroupMember.Read.All",
    ],
  },

  parseApiError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== "object") return null

    // Graph API error shape: { error: { code, message } }
    const graphError = error as {
      error?: { code?: string; message?: string }
      status?: number
      message?: string
      code?: string
    }

    if (graphError.error?.code) {
      const code = graphError.error.code
      const message = graphError.error.message || code

      const codeStatusMap: Record<string, number> = {
        InvalidAuthenticationToken: 401,
        Authorization_RequestDenied: 403,
        Request_ResourceNotFound: 404,
        ResourceNotFound: 404,
        ErrorItemNotFound: 404,
        BadRequest: 400,
        Request_BadRequest: 400,
        ErrorInvalidRequest: 400,
        TooManyRequests: 429,
        ServiceNotAvailable: 503,
        UnknownError: 500,
      }

      return {
        status: codeStatusMap[code] || 500,
        message,
      }
    }

    // Direct error with status
    if (typeof graphError.status === "number" && graphError.message) {
      return { status: graphError.status, message: graphError.message }
    }

    return null
  },

  canRefresh(credential: BaseCredential): boolean {
    const kind = credential.credentialKind
    return kind !== "access-token" && kind !== "service-principal"
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    const c = credential as MicrosoftCredential
    return {
      provider: "microsoft",
      credentialKind: c.credentialKind,
      refresh_token: c.refresh_token,
      client_id: c.client_id,
      tenant_id: c.tenant_id,
      token_uri: c.token_uri,
    } as MicrosoftCredential
  },
}
