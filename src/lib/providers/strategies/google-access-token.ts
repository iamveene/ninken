import type { AccessTokenCredential } from "../types"

/**
 * Google opaque access token strategy.
 *
 * Google access tokens start with `ya29.` and are opaque (not JWTs).
 * They cannot be refreshed — the red teamer must use them before they expire.
 */

/** Detect a Google access token by its `ya29.` prefix. */
export function detectGoogleAccessToken(raw: unknown): boolean {
  return typeof raw === "string" && raw.startsWith("ya29.")
}

/** Build an AccessTokenCredential from a raw Google access token string. */
export function validateGoogleAccessToken(
  raw: string
): { valid: true; credential: AccessTokenCredential } | { valid: false; error: string } {
  const token = raw.trim()
  if (!token.startsWith("ya29.")) {
    return { valid: false, error: "Not a Google access token (expected ya29. prefix)" }
  }
  if (token.length < 20) {
    return { valid: false, error: "Access token too short" }
  }
  return {
    valid: true,
    credential: {
      provider: "google",
      credentialKind: "access-token",
      access_token: token,
    },
  }
}
