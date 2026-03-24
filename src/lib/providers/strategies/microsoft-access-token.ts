import type { AccessTokenCredential } from "../types"
import { decodeJwtPayload } from "../../microsoft"

/**
 * Microsoft access token strategy.
 *
 * Microsoft access tokens are JWTs starting with `eyJ` containing
 * `tid` (tenant ID) or `iss` with `sts.windows.net` in the claims.
 * They cannot be refreshed — the red teamer must use them before they expire.
 */

/** Detect a Microsoft access token JWT by decoding its claims. */
export function detectMicrosoftAccessToken(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw.startsWith("eyJ")) return false
  const payload = decodeJwtPayload(raw)
  if (!payload) return false
  return !!(
    payload.tid ||
    (typeof payload.iss === "string" && payload.iss.includes("sts.windows.net"))
  )
}

/** Build an AccessTokenCredential from a raw Microsoft access token JWT. */
export function validateMicrosoftAccessToken(
  raw: string
): { valid: true; credential: AccessTokenCredential; email?: string } | { valid: false; error: string } {
  const token = raw.trim()
  const payload = decodeJwtPayload(token)
  if (!payload) {
    return { valid: false, error: "Failed to decode JWT payload" }
  }

  const hasMsClaim =
    payload.tid ||
    (typeof payload.iss === "string" && payload.iss.includes("sts.windows.net"))
  if (!hasMsClaim) {
    return { valid: false, error: "JWT does not contain Microsoft-specific claims" }
  }

  // Extract useful metadata from JWT claims
  const expiresAt = typeof payload.exp === "number" ? payload.exp : undefined
  const email =
    (typeof payload.upn === "string" ? payload.upn : undefined) ||
    (typeof payload.preferred_username === "string" ? payload.preferred_username : undefined)
  const scopes =
    typeof payload.scp === "string"
      ? payload.scp.split(" ").filter(Boolean)
      : undefined

  return {
    valid: true,
    credential: {
      provider: "microsoft",
      credentialKind: "access-token",
      access_token: token,
      expires_at: expiresAt,
      email,
      scopes,
    },
    email,
  }
}
