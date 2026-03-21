/**
 * Generalized JWT decoder with platform detection and claims analysis.
 * Extends the pattern from src/lib/microsoft.ts decodeJwtPayload.
 */

import type { Platform } from "./token-types"

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  /** Raw parts for display */
  raw: { header: string; payload: string; signature: string }
}

export interface JwtAnalysis {
  decoded: DecodedJwt
  platform: Platform
  tokenType: "access" | "id" | "unknown"
  /** Extracted claims of interest */
  claims: JwtClaim[]
  /** Scopes found in the token */
  scopes: string[]
  /** Expiry information */
  expiry: {
    issuedAt: Date | null
    expiresAt: Date | null
    notBefore: Date | null
    isExpired: boolean
    remainingSeconds: number | null
  }
  /** Security observations */
  observations: string[]
}

export interface JwtClaim {
  key: string
  value: unknown
  label: string
  category: "identity" | "authorization" | "metadata" | "timing" | "security"
  /** Whether this claim has security relevance */
  sensitive: boolean
}

/**
 * Decode a JWT string into its parts. No signature verification.
 */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.trim().split(".")
    if (parts.length !== 3) return null

    const decodeBase64Url = (s: string): string => {
      const padded = s.replace(/-/g, "+").replace(/_/g, "/")
      return atob(padded)
    }

    const headerJson = decodeBase64Url(parts[0])
    const payloadJson = decodeBase64Url(parts[1])

    return {
      header: JSON.parse(headerJson),
      payload: JSON.parse(payloadJson),
      signature: parts[2],
      raw: { header: parts[0], payload: parts[1], signature: parts[2] },
    }
  } catch {
    return null
  }
}

/**
 * Detect the platform from JWT claims.
 */
export function detectPlatform(payload: Record<string, unknown>): Platform {
  const iss = payload.iss as string | undefined

  // Microsoft tokens
  if (iss?.includes("login.microsoftonline.com") || iss?.includes("sts.windows.net")) {
    return "microsoft"
  }

  // Google tokens
  if (iss === "accounts.google.com" || iss === "https://accounts.google.com") {
    return "google"
  }

  // Check for Microsoft-specific claims
  if (payload.tid || payload.oid || payload.upn) {
    return "microsoft"
  }

  // Check for Google-specific claims
  if (payload.azp && payload.at_hash && payload.email_verified !== undefined) {
    return "google"
  }

  return "unknown"
}

/**
 * Determine token type from claims.
 */
function detectTokenType(payload: Record<string, unknown>, platform: Platform): "access" | "id" | "unknown" {
  if (platform === "microsoft") {
    // Microsoft access tokens typically have scp or roles
    if (payload.scp || payload.roles) return "access"
    // ID tokens have nonce or at_hash
    if (payload.nonce || payload.at_hash) return "id"
  }

  if (platform === "google") {
    // Google ID tokens have at_hash
    if (payload.at_hash) return "id"
    // Google access tokens are typically opaque, not JWTs
    if (payload.scope) return "access"
  }

  return "unknown"
}

/**
 * Map known claims to labeled claim objects.
 */
const CLAIM_LABELS: Record<string, { label: string; category: JwtClaim["category"]; sensitive: boolean }> = {
  // Identity
  sub: { label: "Subject (User ID)", category: "identity", sensitive: false },
  oid: { label: "Object ID (Azure AD)", category: "identity", sensitive: false },
  upn: { label: "User Principal Name", category: "identity", sensitive: true },
  preferred_username: { label: "Preferred Username", category: "identity", sensitive: true },
  email: { label: "Email Address", category: "identity", sensitive: true },
  name: { label: "Display Name", category: "identity", sensitive: true },
  given_name: { label: "Given Name", category: "identity", sensitive: true },
  family_name: { label: "Family Name", category: "identity", sensitive: true },
  unique_name: { label: "Unique Name", category: "identity", sensitive: true },

  // Authorization
  scp: { label: "Scopes (Delegated)", category: "authorization", sensitive: false },
  roles: { label: "Roles (Application)", category: "authorization", sensitive: false },
  wids: { label: "Azure AD Role IDs", category: "authorization", sensitive: false },
  scope: { label: "Scopes", category: "authorization", sensitive: false },
  azp: { label: "Authorized Party", category: "authorization", sensitive: false },

  // Metadata
  iss: { label: "Issuer", category: "metadata", sensitive: false },
  aud: { label: "Audience", category: "metadata", sensitive: false },
  tid: { label: "Tenant ID", category: "metadata", sensitive: false },
  appid: { label: "Application ID", category: "metadata", sensitive: false },
  app_displayname: { label: "Application Name", category: "metadata", sensitive: false },
  ver: { label: "Token Version", category: "metadata", sensitive: false },
  idtyp: { label: "Identity Type", category: "metadata", sensitive: false },
  acr: { label: "Authentication Context Class", category: "security", sensitive: false },
  amr: { label: "Authentication Methods", category: "security", sensitive: false },

  // Timing
  iat: { label: "Issued At", category: "timing", sensitive: false },
  exp: { label: "Expires At", category: "timing", sensitive: false },
  nbf: { label: "Not Before", category: "timing", sensitive: false },
  auth_time: { label: "Authentication Time", category: "timing", sensitive: false },

  // Security
  nonce: { label: "Nonce", category: "security", sensitive: false },
  at_hash: { label: "Access Token Hash", category: "security", sensitive: false },
  c_hash: { label: "Code Hash", category: "security", sensitive: false },
  xms_cc: { label: "Client Capabilities", category: "security", sensitive: false },
  xms_ssm: { label: "Session Management", category: "security", sensitive: false },
  ipaddr: { label: "IP Address", category: "security", sensitive: true },
  onprem_sid: { label: "On-Premises SID", category: "security", sensitive: true },
}

function mapClaims(payload: Record<string, unknown>): JwtClaim[] {
  const claims: JwtClaim[] = []

  for (const [key, value] of Object.entries(payload)) {
    const meta = CLAIM_LABELS[key]
    claims.push({
      key,
      value,
      label: meta?.label ?? key,
      category: meta?.category ?? "metadata",
      sensitive: meta?.sensitive ?? false,
    })
  }

  return claims
}

/**
 * Extract scopes from a JWT payload.
 */
function extractScopes(payload: Record<string, unknown>): string[] {
  // Microsoft: scp claim (space-separated string)
  if (typeof payload.scp === "string") {
    return payload.scp.split(" ").filter(Boolean)
  }

  // Microsoft: roles claim (array)
  if (Array.isArray(payload.roles)) {
    return payload.roles.filter((r): r is string => typeof r === "string")
  }

  // Google: scope claim
  if (typeof payload.scope === "string") {
    return payload.scope.split(" ").filter(Boolean)
  }

  return []
}

/**
 * Analyze expiry information from claims.
 */
function analyzeExpiry(payload: Record<string, unknown>): JwtAnalysis["expiry"] {
  const now = Math.floor(Date.now() / 1000)

  const exp = typeof payload.exp === "number" ? payload.exp : null
  const iat = typeof payload.iat === "number" ? payload.iat : null
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null

  return {
    issuedAt: iat ? new Date(iat * 1000) : null,
    expiresAt: exp ? new Date(exp * 1000) : null,
    notBefore: nbf ? new Date(nbf * 1000) : null,
    isExpired: exp ? now > exp : false,
    remainingSeconds: exp ? Math.max(0, exp - now) : null,
  }
}

/**
 * Generate security observations from the JWT.
 */
function generateObservations(
  payload: Record<string, unknown>,
  platform: Platform,
  expiry: JwtAnalysis["expiry"]
): string[] {
  const obs: string[] = []

  if (expiry.isExpired) {
    obs.push("Token is EXPIRED. Cannot be used for API calls.")
  } else if (expiry.remainingSeconds !== null && expiry.remainingSeconds < 300) {
    obs.push("Token expires in less than 5 minutes.")
  }

  if (platform === "microsoft") {
    if (payload.tid === "9188040d-6c67-4c5b-b112-36a304b66dad") {
      obs.push("Personal Microsoft account (MSA) token, not organizational.")
    }

    if (Array.isArray(payload.amr)) {
      const amr = payload.amr as string[]
      if (amr.includes("pwd") && !amr.includes("mfa") && !amr.includes("ngcmfa")) {
        obs.push("Authenticated with password only -- no MFA detected.")
      }
      if (amr.includes("mfa")) {
        obs.push("Multi-factor authentication was used.")
      }
    }

    if (payload.xms_cc && Array.isArray(payload.xms_cc)) {
      obs.push("Token supports Continuous Access Evaluation (CAE).")
    }

    if (typeof payload.scp === "string" && payload.scp.includes("Directory.Read.All")) {
      obs.push("Token has Directory.Read.All -- full directory enumeration possible.")
    }

    if (typeof payload.wids === "object" && Array.isArray(payload.wids)) {
      obs.push(`User holds ${(payload.wids as string[]).length} Azure AD directory role(s).`)
    }
  }

  if (platform === "google") {
    if (payload.hd) {
      obs.push(`Google Workspace domain: ${payload.hd as string}`)
    }
    if (payload.email_verified === false) {
      obs.push("Email is NOT verified.")
    }
  }

  return obs
}

/**
 * Full JWT analysis pipeline.
 */
export function analyzeJwt(token: string): JwtAnalysis | null {
  const decoded = decodeJwt(token)
  if (!decoded) return null

  const platform = detectPlatform(decoded.payload)
  const tokenType = detectTokenType(decoded.payload, platform)
  const claims = mapClaims(decoded.payload)
  const scopes = extractScopes(decoded.payload)
  const expiry = analyzeExpiry(decoded.payload)
  const observations = generateObservations(decoded.payload, platform, expiry)

  return {
    decoded,
    platform,
    tokenType,
    claims,
    scopes,
    expiry,
    observations,
  }
}
