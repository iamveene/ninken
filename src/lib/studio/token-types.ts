/**
 * Token type definitions for Google and Microsoft platforms.
 * Used by the Studio Token Analyzer to identify and describe tokens.
 */

export type Platform = "google" | "microsoft" | "unknown"

export interface TokenTypeDefinition {
  id: string
  platform: Platform
  name: string
  description: string
  format: "jwt" | "opaque" | "refresh" | "api_key"
  /** Typical lifetime in seconds, null = long-lived */
  defaultLifetime: number | null
  /** Whether this token can be refreshed for a new access token */
  refreshable: boolean
  /** Common header/claim patterns used to identify this token type */
  identifiers: {
    prefixes?: string[]
    claims?: string[]
    patterns?: RegExp[]
  }
  /** OPSEC notes for red teamers */
  opsecNotes: string[]
}

export const TOKEN_TYPES: TokenTypeDefinition[] = [
  // --- Google ---
  {
    id: "google-access-token",
    platform: "google",
    name: "Google OAuth2 Access Token",
    description: "Opaque bearer token for Google API access. Obtained via OAuth2 authorization code or refresh token grant.",
    format: "opaque",
    defaultLifetime: 3600,
    refreshable: false,
    identifiers: {
      prefixes: ["ya29."],
      patterns: [/^ya29\.[A-Za-z0-9_-]+$/],
    },
    opsecNotes: [
      "Short-lived (1 hour default). Revocation is immediate.",
      "Logged in Google Cloud Audit Logs under DATA_READ / DATA_WRITE.",
      "Use tokeninfo endpoint to check remaining lifetime before operations.",
    ],
  },
  {
    id: "google-refresh-token",
    platform: "google",
    name: "Google OAuth2 Refresh Token",
    description: "Long-lived token used to obtain new access tokens without user interaction.",
    format: "refresh",
    defaultLifetime: null,
    refreshable: true,
    identifiers: {
      prefixes: ["1//"],
      patterns: [/^1\/\/[A-Za-z0-9_-]+$/],
    },
    opsecNotes: [
      "Does not expire unless revoked or unused for 6 months.",
      "Using a refresh token does NOT generate an audit log entry by itself.",
      "Store securely -- this is equivalent to persistent access.",
      "Revocation: apps.googleusercontent.com -> Security -> Third-party apps.",
    ],
  },
  {
    id: "google-id-token",
    platform: "google",
    name: "Google ID Token (OIDC JWT)",
    description: "JWT containing user identity claims. Used for authentication, not API authorization.",
    format: "jwt",
    defaultLifetime: 3600,
    refreshable: false,
    identifiers: {
      claims: ["iss", "sub", "aud", "email", "at_hash"],
      patterns: [/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/],
    },
    opsecNotes: [
      "Contains PII (email, name, picture). Be careful with logging.",
      "Verify issuer is accounts.google.com or https://accounts.google.com.",
      "Cannot be used to call Google APIs directly.",
    ],
  },
  {
    id: "google-sa-key",
    platform: "google",
    name: "Google Service Account Key",
    description: "JSON key file for a GCP service account. Used to mint access tokens server-side.",
    format: "api_key",
    defaultLifetime: null,
    refreshable: true,
    identifiers: {
      patterns: [/"type"\s*:\s*"service_account"/],
    },
    opsecNotes: [
      "Extremely high value. Equivalent to long-term credential.",
      "Can impersonate users via domain-wide delegation.",
      "Key creation/use logged in Cloud Audit Logs.",
      "Rotate immediately if compromised -- keys cannot be revoked individually.",
    ],
  },
  {
    id: "google-api-key",
    platform: "google",
    name: "Google API Key",
    description: "Simple API key for accessing public Google APIs. No user context.",
    format: "api_key",
    defaultLifetime: null,
    refreshable: false,
    identifiers: {
      prefixes: ["AIza"],
      patterns: [/^AIza[A-Za-z0-9_-]{35}$/],
    },
    opsecNotes: [
      "No user context -- only identifies the project.",
      "Often unrestricted. Check API restrictions in console.",
      "Usage is logged but attribution is limited to project.",
    ],
  },

  // --- Microsoft ---
  {
    id: "microsoft-access-token",
    platform: "microsoft",
    name: "Microsoft Access Token (JWT)",
    description: "JWT bearer token for Microsoft Graph and Azure AD APIs. Contains scopes in scp claim.",
    format: "jwt",
    defaultLifetime: 3600,
    refreshable: false,
    identifiers: {
      claims: ["aud", "iss", "scp", "tid", "oid"],
      patterns: [/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/],
    },
    opsecNotes: [
      "Default lifetime 60-90 minutes. CAE-capable tokens may be longer.",
      "scp claim contains delegated permissions (space-separated).",
      "roles claim contains application permissions.",
      "tid claim reveals the tenant ID.",
      "Continuous Access Evaluation (CAE) can revoke mid-session.",
    ],
  },
  {
    id: "microsoft-refresh-token",
    platform: "microsoft",
    name: "Microsoft Refresh Token",
    description: "Long-lived token for obtaining new access tokens. FOCI tokens work across multiple apps.",
    format: "refresh",
    defaultLifetime: null,
    refreshable: true,
    identifiers: {
      prefixes: ["0."],
      patterns: [/^0\.[A-Za-z0-9_-]+$/],
    },
    opsecNotes: [
      "Default lifetime 90 days (sliding window). Can be revoked.",
      "FOCI (Family of Client IDs) tokens can be exchanged across apps in the same family.",
      "Check foci claim in token response to identify FOCI membership.",
      "Revocation: Azure Portal -> Enterprise Applications -> Sign-in logs.",
    ],
  },
  {
    id: "microsoft-id-token",
    platform: "microsoft",
    name: "Microsoft ID Token (OIDC JWT)",
    description: "JWT containing user identity claims from Azure AD. Used for SSO authentication.",
    format: "jwt",
    defaultLifetime: 3600,
    refreshable: false,
    identifiers: {
      claims: ["iss", "sub", "aud", "preferred_username", "tid", "nonce"],
    },
    opsecNotes: [
      "Contains UPN, tenant ID, and object ID.",
      "iss claim format: https://login.microsoftonline.com/{tenant}/v2.0",
      "Cannot be used for API authorization.",
    ],
  },
  {
    id: "microsoft-prt",
    platform: "microsoft",
    name: "Microsoft Primary Refresh Token",
    description: "Device-bound SSO token. Enables seamless sign-on to all Azure AD-integrated applications.",
    format: "opaque",
    defaultLifetime: null,
    refreshable: true,
    identifiers: {},
    opsecNotes: [
      "Extremely high value. Equivalent to full device-level SSO.",
      "TPM-bound on modern hardware -- extraction requires privilege escalation.",
      "Can be used to generate access tokens for any Azure AD app.",
      "Tools: ROADtoken, AADInternals, Mimikatz (CloudAP).",
      "Detection: Sign-in logs show 'PRT' as auth method.",
    ],
  },
  {
    id: "microsoft-app-secret",
    platform: "microsoft",
    name: "Microsoft App Client Secret",
    description: "Application credential for confidential client OAuth2 flows.",
    format: "api_key",
    defaultLifetime: null,
    refreshable: true,
    identifiers: {
      patterns: [/^[A-Za-z0-9~._-]{34,}$/],
    },
    opsecNotes: [
      "Used in client_credentials flow -- no user context.",
      "Check application permissions vs delegated permissions.",
      "Expiry is configurable (1-2 years typical).",
      "Usage logged in Azure AD Sign-in logs (service principal).",
    ],
  },
]

/**
 * Attempt to identify the type of a token string by matching patterns.
 */
export function identifyTokenType(token: string): TokenTypeDefinition | null {
  const trimmed = token.trim()

  for (const tokenType of TOKEN_TYPES) {
    const { prefixes, patterns } = tokenType.identifiers

    if (prefixes) {
      for (const prefix of prefixes) {
        if (trimmed.startsWith(prefix)) return tokenType
      }
    }

    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(trimmed)) return tokenType
      }
    }
  }

  // Try to detect JWT format generically
  if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    // It's a JWT but we need to inspect claims to determine platform
    return null // Let jwt-decoder handle platform detection
  }

  return null
}

/**
 * Get all token types for a specific platform.
 */
export function getTokenTypesForPlatform(platform: Platform): TokenTypeDefinition[] {
  return TOKEN_TYPES.filter((t) => t.platform === platform)
}
