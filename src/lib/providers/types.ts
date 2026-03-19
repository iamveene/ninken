export type ProviderId =
  | "google"
  | "microsoft"
  | "github"
  | "gitlab"
  | "slack"
  | "aws"

// Base credential shape — every provider extends this
export type BaseCredential = {
  provider: ProviderId
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

// Profile stored in IndexedDB — credential + metadata
export type StoredProfile = {
  id: string
  provider: ProviderId
  credential: BaseCredential
  email?: string
  label?: string
  addedAt: number
}

// What gets stored in the active-profile httpOnly cookie (minimal, server-readable)
export type ActiveTokenCookie<C extends BaseCredential = BaseCredential> = {
  provider: ProviderId
  credential: C
}

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

  // Scope/capability checking
  readonly scopeAppMap: Record<string, string[]>

  // Error parsing — return null if not recognized
  parseApiError(error: unknown): { status: number; message: string } | null

  // Default route after auth
  readonly defaultRoute: string
}
