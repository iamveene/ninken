export type ProviderId =
  | "google"
  | "microsoft"
  | "github"
  | "gitlab"
  | "slack"
  | "aws"

export type CredentialKind =
  | "oauth"
  | "foci"
  | "service-account"
  | "service-principal"
  | "access-token"
  | "browser-session"

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

// Slack browser session credential (exfiltrated d cookie + bootstrapped xoxc token)
export type SlackCredential = BaseCredential & {
  provider: "slack"
  d_cookie: string      // xoxd-... (the browser session cookie)
  xoxc_token: string    // xoxc-... (extracted from page boot_data)
  team_id: string       // T01234...
  team_domain: string   // workspace subdomain
  user_id: string       // U01234...
}

// Profile stored in IndexedDB — credential + metadata
export type StoredProfile = {
  id: string
  provider: ProviderId
  credential: BaseCredential
  email?: string
  label?: string
  addedAt: number
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
