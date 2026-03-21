export type ProviderId =
  | "google"
  | "microsoft"
  | "github"
  | "gitlab"
  | "slack"
  | "aws"
  | "gcp"

export type CredentialKind =
  | "oauth"
  | "foci"
  | "service-account"
  | "service-principal"
  | "access-token"
  | "browser-session"
  | "api-token"
  | "prt"
  | "prt-cookie"
  | "api-key"

// Base credential shape — every provider extends this
export type BaseCredential = {
  provider: ProviderId
  credentialKind?: CredentialKind
}

// Raw access token credential (non-refreshable, any provider)
export type AccessTokenCredential = BaseCredential & {
  credentialKind: "access-token"
  access_token: string
  expires_at?: number    // Unix timestamp (seconds)
  email?: string
  scopes?: string[]
}

/** Strip an AccessTokenCredential down to its essential fields. */
export function minimalAccessToken(credential: AccessTokenCredential): AccessTokenCredential {
  return {
    provider: credential.provider,
    credentialKind: "access-token",
    access_token: credential.access_token,
    expires_at: credential.expires_at,
    email: credential.email,
    scopes: credential.scopes,
  }
}

// Google-specific credential (wraps existing TokenData shape)
export type GoogleCredential = BaseCredential & {
  provider: "google"
  refresh_token: string
  client_id: string
  client_secret: string
  token?: string
  token_uri?: string
}

// Google Service Account credential (JWT assertion flow)
export type GoogleServiceAccountCredential = BaseCredential & {
  provider: "google"
  credentialKind: "service-account"
  client_email: string
  private_key: string
  private_key_id: string
  project_id: string
  token_uri?: string
}

// Microsoft-specific credential (FOCI public client — no client_secret)
export type MicrosoftCredential = BaseCredential & {
  provider: "microsoft"
  refresh_token?: string
  client_id: string
  tenant_id: string
  access_token?: string
  scope?: string[]
  token_uri?: string
  account?: string
  foci?: boolean
}

// Microsoft Service Principal credential (client_credentials grant)
export type MicrosoftServicePrincipalCredential = BaseCredential & {
  provider: "microsoft"
  credentialKind: "service-principal"
  client_id: string
  client_secret: string
  tenant_id: string
  token_uri?: string
}

// Microsoft PRT credential (Primary Refresh Token with HMAC session key)
export type MicrosoftPrtCredential = BaseCredential & {
  provider: "microsoft"
  credentialKind: "prt"
  prt: string
  session_key: string  // base64-encoded HMAC key
  tenant_id: string
  client_id?: string
}

// Microsoft PRT Cookie credential (pre-built x-ms-RefreshTokenCredential)
export type MicrosoftPrtCookieCredential = BaseCredential & {
  provider: "microsoft"
  credentialKind: "prt-cookie"
  prt_cookie: string  // The x-ms-RefreshTokenCredential value
  tenant_id: string
  client_id?: string
}

// Microsoft Browser Session credential (ESTSAUTHPERSISTENT cookie)
export type MicrosoftBrowserSessionCredential = BaseCredential & {
  provider: "microsoft"
  credentialKind: "browser-session"
  estsauthpersistent: string
  tenant_id?: string
  client_id?: string
}

// AWS credential (IAM access keys, optionally with STS session token)
export type AwsCredential = BaseCredential & {
  provider: "aws"
  credentialKind: "access-token"
  access_key_id: string
  secret_access_key: string  // never log this field
  session_token?: string
  default_region?: string
  account_id?: string
  arn?: string
}

// GCP API Key credential (project-scoped, no user context)
export type GcpApiKeyCredential = BaseCredential & {
  provider: "gcp"
  credentialKind: "api-key"
  api_key: string         // AIza... key — never log
  project_id?: string     // Discovered via probing or user input
}

// Slack browser session credential (exfiltrated d cookie + bootstrapped xoxc token)
export type SlackBrowserSessionCredential = BaseCredential & {
  provider: "slack"
  credentialKind: "browser-session"
  d_cookie: string      // xoxd-... (the browser session cookie)
  xoxc_token: string    // xoxc-... (extracted from page boot_data)
  team_id: string       // T01234...
  team_domain: string   // workspace subdomain
  user_id: string       // U01234...
}

// Slack API token credential (xoxb- bot token or xoxp- user token)
export type SlackApiTokenCredential = BaseCredential & {
  provider: "slack"
  credentialKind: "api-token"
  token_type: "bot" | "user"
  access_token: string
  team_id?: string
  team_domain?: string
  user_id?: string
  bot_id?: string
  scopes?: string[]
}

// Union of all Slack credential types
export type SlackCredential = SlackBrowserSessionCredential | SlackApiTokenCredential

// Profile stored in IndexedDB — credential + metadata
export type StoredProfile = {
  id: string
  provider: ProviderId
  credential: BaseCredential
  email?: string
  label?: string
  addedAt: number
  // Multi-token: map of linked provider credentials
  tokens?: Partial<Record<ProviderId, BaseCredential>>
  // Which provider is currently active (defaults to `provider` if unset)
  activeProvider?: ProviderId
}

/**
 * Get the currently active credential from a profile.
 * For multi-token profiles, returns the credential for the active provider.
 * Falls back to the primary `credential` field for backward compat.
 */
export function getActiveCredential(profile: StoredProfile): BaseCredential {
  if (profile.tokens && profile.activeProvider) {
    const cred = profile.tokens[profile.activeProvider]
    if (cred) return cred
  }
  return profile.credential
}

/**
 * Get all provider IDs linked to a profile.
 * For single-token profiles, returns `[profile.provider]`.
 */
export function getProfileProviders(profile: StoredProfile): ProviderId[] {
  if (profile.tokens) {
    const ids = Object.keys(profile.tokens) as ProviderId[]
    if (ids.length > 0) return ids
  }
  return [profile.provider]
}

// What gets stored in the active-profile httpOnly cookie (minimal, server-readable).
// Direct mode: credential fits in the cookie.
// Session mode: credential is server-side, cookie holds only a sessionId reference.
export type ActiveTokenCookie =
  | { provider: ProviderId; credential: BaseCredential }
  | { provider: ProviderId; sessionId: string }

// Nav item definition returned by providers
export type ProviderNavItem = {
  id: string
  title: string
  href: string
  iconName: string
}

// What a provider must implement
export interface ServiceProvider {
  readonly id: ProviderId
  readonly name: string
  readonly description: string
  readonly iconName: string

  // Credential handling
  detectCredential(raw: unknown): boolean
  validateCredential(
    raw: unknown
  ):
    | { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string }

  // Token operations — provider-specific access token retrieval
  getAccessToken(credential: BaseCredential): Promise<string>
  fetchScopes(credential: BaseCredential): Promise<string[]>

  // Email resolution endpoint (null if not supported)
  readonly emailEndpoint: string | null

  // Navigation
  readonly operateNavItems: ProviderNavItem[]
  readonly auditNavItems: ProviderNavItem[]
  // Service-specific sub-navigation (e.g., gmail → Inbox, Starred, Sent)
  readonly serviceSubNav?: Record<string, ProviderNavItem[]>

  // Scope/capability checking
  readonly scopeAppMap: Record<string, string[]>

  // Error parsing — return null if not recognized
  parseApiError(error: unknown): { status: number; message: string } | null

  // Async credential enrichment before validation (e.g., Slack xoxc- bootstrap)
  bootstrapCredential?(raw: unknown): Promise<unknown>

  // Credential lifecycle
  canRefresh?(credential: BaseCredential): boolean
  minimalCredential(credential: BaseCredential): BaseCredential

  // Default route after auth
  readonly defaultRoute: string
}
