import {
  minimalAccessToken,
  type AccessTokenCredential,
  type BaseCredential,
  type MicrosoftCredential,
  type ServiceProvider,
} from "./types"
import type { CredentialStrategy } from "./credential-strategy"
import { decodeScopesFromJwt } from "../microsoft"
import {
microsoftOAuthStrategy,
  normalizeRaw,
  TEAMS_FOCI_CLIENT_ID,
} from "./strategies/microsoft-oauth"
import { microsoftServicePrincipalStrategy } from "./strategies/microsoft-service-principal"

getAccessToken as msGetAccessToken,
  decodeJwtPayload,
  decodeScopesFromJwt,
} from "../microsoft"
import {
  detectMicrosoftAccessToken,
  validateMicrosoftAccessToken,
} from "./strategies/microsoft-access-token"

const strategies: CredentialStrategy[] = [
  // Service principal must be checked before OAuth because both may have client_id + tenant_id,
  // but service principal has client_secret and no refresh_token.
  microsoftServicePrincipalStrategy,
  microsoftOAuthStrategy,
]

function strategyForKind(credential: BaseCredential) {
  return strategies.find((s) => s.kind === credential.credentialKind)
}

/** Extracted account from a multi-account cache file */
export type ExtractedMicrosoftAccount = {
  credential: MicrosoftCredential
  email?: string
  label?: string
  format: string
}

/**
 * Extract ALL credentials from an Azure CLI MSAL cache or PowerShell context.
 * Returns an array so the UI can let the user pick which accounts to import.
 * For single-credential formats, returns a one-element array.
 */
export function extractAllCredentials(
  raw: Record<string, unknown>,
): ExtractedMicrosoftAccount[] {
  // Azure CLI MSAL cache: { AccessToken: {...}, RefreshToken: {...}, Account: {...}, ... }
  if (raw.RefreshToken && typeof raw.RefreshToken === "object") {
    const rtEntries = Object.values(
      raw.RefreshToken as Record<string, Record<string, unknown>>,
    )
    const accounts = raw.Account
      ? Object.values(
          raw.Account as Record<string, Record<string, unknown>>,
        )
      : []

    const results: ExtractedMicrosoftAccount[] = []
    for (const rt of rtEntries) {
      if (typeof rt.secret !== "string" || !rt.secret) continue

      // Cross-reference with Account entries by home_account_id
      const homeId = rt.home_account_id as string | undefined
      const account = accounts.find(
        (a) =>
          a.home_account_id === homeId || a.username === rt.username,
      )

      const isFoci = rt.family_id === "1"
      const email = (account?.username ?? rt.username) as
        | string
        | undefined
      const tenantId = (rt.realm ?? rt.environment) as
        | string
        | undefined

      results.push({
        credential: {
          provider: "microsoft",
          credentialKind: isFoci ? "foci" : "oauth",
          refresh_token: rt.secret as string,
          client_id:
            (rt.client_id as string) || TEAMS_FOCI_CLIENT_ID,
          tenant_id: tenantId || "",
          foci: isFoci,
          account: email,
        },
        email,
        format: "Azure CLI MSAL Token Cache",
      })
    }
    return results
  }

  // Azure PowerShell: { Contexts: { "Default": { Account: { Id, Tenants }, ... } } }
  if (raw.Contexts && typeof raw.Contexts === "object") {
    const contexts = raw.Contexts as Record<
      string,
      Record<string, unknown>
    >
    const results: ExtractedMicrosoftAccount[] = []
    for (const [name, ctx] of Object.entries(contexts)) {
      const account = ctx.Account as
        | Record<string, unknown>
        | undefined
      const tenant =
        (account?.Tenants as string[])?.[0] || ""
      const email = account?.Id as string | undefined

      results.push({
        credential: {
          provider: "microsoft",
          credentialKind: "oauth",
          refresh_token: "",
          tenant_id: tenant,
          client_id: TEAMS_FOCI_CLIENT_ID,
          account: email,
        },
        email,
        label: name,
        format: "Azure PowerShell Context",
      })
    }
    return results
  }

  // Single credential: use existing normalizeRaw + validateCredential path
  const obj = normalizeRaw(raw)

  if (typeof obj.refresh_token !== "string" || !obj.refresh_token) {
    return []
  }

  const tenantId = (obj.tenant_id || obj.tenantId) as
    | string
    | undefined
  if (!tenantId) return []

  const clientId =
    typeof obj.client_id === "string" && obj.client_id
      ? obj.client_id
      : TEAMS_FOCI_CLIENT_ID

  const isFoci = obj.foci === true || obj.foci === "1"

  // Detect specific format
  let format = "Microsoft OAuth Token"
  if (isFoci) format = "FOCI Refresh Token"

  return [
    {
      credential: {
        provider: "microsoft",
        credentialKind: isFoci ? "foci" : "oauth",
        refresh_token: obj.refresh_token as string,
        client_id: clientId,
        tenant_id: tenantId,
        access_token:
          typeof obj.access_token === "string"
            ? obj.access_token
            : undefined,
        scope: Array.isArray(obj.scope)
          ? (obj.scope as string[])
          : typeof obj.scope === "string"
            ? (obj.scope as string).split(" ").filter(Boolean)
            : undefined,
        token_uri:
          typeof obj.token_uri === "string"
            ? obj.token_uri
            : undefined,
        account:
          typeof obj.account === "string" ? obj.account : undefined,
        foci: isFoci,
      },
      email:
        typeof obj.email === "string"
          ? obj.email
          : typeof obj.account === "string"
            ? obj.account
            : undefined,
      format,
    },
  ]
}

export const microsoftProvider: ServiceProvider = {
  id: "microsoft",
  name: "Microsoft 365",
  description: "Outlook, OneDrive, Teams, Entra ID",
  iconName: "Monitor",

  detectCredential(raw: unknown): boolean {
return strategies.some((s) => s.detect(raw))

// Raw JWT string: check for Microsoft-specific claims
    if (detectMicrosoftAccessToken(raw)) return true
    if (!raw || typeof raw !== "object") return false
    const obj = normalizeRaw(raw as Record<string, unknown>)
    return isMicrosoftShape(obj)
  },

  validateCredential(
    raw: unknown,
  ):
| { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string } {
    const strategy = strategies.find((s) => s.detect(raw))
    if (!strategy) {
      return {
        valid: false,
        error: "Unrecognized Microsoft credential format",
      }

| { valid: true; credential: MicrosoftCredential | AccessTokenCredential; email?: string }
    | { valid: false; error: string } {
    // Raw access token JWT string
    if (typeof raw === "string" && detectMicrosoftAccessToken(raw)) {
      return validateMicrosoftAccessToken(raw)
    }
    if (!raw || typeof raw !== "object") {
      return { valid: false, error: "Invalid JSON" }
    }
    return strategy.validate(raw)
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
const strategy = strategyForKind(credential)
    if (!strategy) {
      throw new Error(
        `No Microsoft strategy for credential kind: ${credential.credentialKind}`,
      )
    }
    return strategy.getAccessToken(credential)

// Access token credentials: return stored token directly (non-refreshable)
    if (credential.credentialKind === "access-token") {
      return (credential as AccessTokenCredential).access_token
    }
    return msGetAccessToken(credential as MicrosoftCredential)
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    const accessToken = await this.getAccessToken(credential)
    return decodeScopesFromJwt(accessToken)
  },

  emailEndpoint: "/api/microsoft/me",
  defaultRoute: "/m365-dashboard",

  operateNavItems: [
    { id: "outlook", title: "Outlook", href: "/outlook", iconName: "Mail" },
    {
      id: "onedrive",
      title: "OneDrive",
      href: "/onedrive",
      iconName: "HardDrive",
    },
    {
      id: "teams",
      title: "Teams",
      href: "/teams",
      iconName: "MessageSquare",
    },
    { id: "entra", title: "Entra ID", href: "/entra", iconName: "Users" },
  ],

  serviceSubNav: {
    outlook: [
      {
        id: "outlook-inbox",
        title: "Inbox",
        href: "/outlook",
        iconName: "Inbox",
      },
      {
        id: "outlook-sent",
        title: "Sent",
        href: "/outlook?folder=sentitems",
        iconName: "Send",
      },
      {
        id: "outlook-drafts",
        title: "Drafts",
        href: "/outlook?folder=drafts",
        iconName: "FileEdit",
      },
      {
        id: "outlook-junk",
        title: "Junk",
        href: "/outlook?folder=junkemail",
        iconName: "AlertTriangle",
      },
      {
        id: "outlook-deleted",
        title: "Deleted",
        href: "/outlook?folder=deleteditems",
        iconName: "Trash2",
      },
    ],
    onedrive: [
      {
        id: "onedrive-root",
        title: "My Files",
        href: "/onedrive",
        iconName: "FolderOpen",
      },
      {
        id: "onedrive-recent",
        title: "Recent",
        href: "/onedrive?view=recent",
        iconName: "Clock",
      },
      {
        id: "onedrive-shared",
        title: "Shared",
        href: "/onedrive?view=shared",
        iconName: "FolderSync",
      },
    ],
    teams: [
      {
        id: "teams-main",
        title: "Teams",
        href: "/teams",
        iconName: "MessageSquare",
      },
    ],
    entra: [
      {
        id: "entra-users",
        title: "Users",
        href: "/entra",
        iconName: "Users",
      },
      {
        id: "entra-groups",
        title: "Groups",
        href: "/entra?tab=groups",
        iconName: "UsersRound",
      },
      {
        id: "entra-roles",
        title: "Roles",
        href: "/entra?tab=roles",
        iconName: "ShieldCheck",
      },
    ],
  },

  auditNavItems: [
    {
      id: "m365-audit-dashboard",
      title: "Dashboard",
      href: "/m365-audit",
      iconName: "LayoutDashboard",
    },
    {
      id: "m365-audit-users",
      title: "Users",
      href: "/m365-audit/users",
      iconName: "Users",
    },
    {
      id: "m365-audit-groups",
      title: "Groups",
      href: "/m365-audit/groups",
      iconName: "UsersRound",
    },
    {
      id: "m365-audit-roles",
      title: "Roles",
      href: "/m365-audit/roles",
      iconName: "ShieldCheck",
    },
    {
      id: "m365-audit-apps",
      title: "Apps",
      href: "/m365-audit/apps",
      iconName: "AppWindow",
    },
    {
      id: "m365-audit-signins",
      title: "Sign-ins",
      href: "/m365-audit/sign-ins",
      iconName: "LogIn",
    },
    {
      id: "m365-audit-risky",
      title: "Risky Users",
      href: "/m365-audit/risky-users",
      iconName: "AlertTriangle",
    },
    {
      id: "m365-audit-ca",
      title: "Conditional Access",
      href: "/m365-audit/conditional-access",
      iconName: "Shield",
    },
    {
      id: "m365-audit-cross-tenant",
      title: "Cross-Tenant",
      href: "/m365-audit/cross-tenant",
      iconName: "ArrowLeftRight",
    },
    {
      id: "m365-audit-auth-methods",
      title: "Auth Methods",
      href: "/m365-audit/auth-methods",
      iconName: "KeyRound",
    },
    {
      id: "m365-audit-pivot",
      title: "Resource Pivot",
      href: "/m365-audit/pivot",
      iconName: "GitBranch",
    },
    {
      id: "m365-audit-query",
      title: "Query",
      href: "/m365-audit/query",
      iconName: "Search",
    },
    {
      id: "m365-audit-foci",
      title: "FOCI Pivot",
      href: "/m365-audit/foci-pivot",
      iconName: "Shuffle",
    },
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

  parseApiError(
    error: unknown,
  ): { status: number; message: string } | null {
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
    if (
      typeof graphError.status === "number" &&
      graphError.message
    ) {
      return { status: graphError.status, message: graphError.message }
    }

    return null
  },

  canRefresh(credential: BaseCredential): boolean {
    const strategy = strategyForKind(credential)
    if (!strategy) {
      const kind = credential.credentialKind
      return kind !== "access-token" && kind !== "service-principal"
    }
    return strategy.canRefresh(credential)
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
const strategy = strategyForKind(credential)
    if (!strategy) {
      const c = credential as MicrosoftCredential
      return {
        provider: "microsoft",
        credentialKind: c.credentialKind,
        refresh_token: c.refresh_token,
        client_id: c.client_id,
        tenant_id: c.tenant_id,
        token_uri: c.token_uri,
      } as MicrosoftCredential
    }
    return strategy.minimalCredential(credential)

if (credential.credentialKind === "access-token") {
      return minimalAccessToken(credential as AccessTokenCredential)
    }
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
