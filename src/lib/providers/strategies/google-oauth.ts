import type { CredentialStrategy } from "../credential-strategy"
import type { GoogleCredential } from "../types"

/**
 * Normalize raw credential JSON into a flat object with the fields we need.
 * Handles ADC format, nested "installed"/"web" wrappers.
 */
function normalizeGoogleRaw(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  // Unwrap "installed" wrapper (gcloud client_secrets format)
  if (raw.installed && typeof raw.installed === "object") {
    const inner = raw.installed as Record<string, unknown>
    return { ...inner, ...raw, installed: undefined }
  }
  // Unwrap "web" wrapper (web app client_secrets format)
  if (raw.web && typeof raw.web === "object") {
    const inner = raw.web as Record<string, unknown>
    return { ...inner, ...raw, web: undefined }
  }
  return raw
}

function isGoogleOAuthShape(obj: Record<string, unknown>): boolean {
  const norm = normalizeGoogleRaw(obj)

  // Service account keys are handled by the service-account strategy
  if (norm.type === "service_account") return false

  // Must have the three required OAuth fields
  if (
    typeof norm.refresh_token !== "string" ||
    !norm.refresh_token ||
    typeof norm.client_id !== "string" ||
    !norm.client_id ||
    typeof norm.client_secret !== "string" ||
    !norm.client_secret
  ) {
    return false
  }

  // Positive discriminator: type "authorized_user" is always Google
  if (norm.type === "authorized_user") return true

  // Positive discriminator: if token_uri is present, it must be Google's
  const tokenUri = typeof norm.token_uri === "string" ? norm.token_uri : ""
  if (
    tokenUri &&
    !tokenUri.includes("googleapis.com") &&
    !tokenUri.includes("accounts.google.com")
  ) {
    return false
  }

  // Negative discriminator: reject if Microsoft-specific fields are present
  if ("tenant_id" in norm || "tenantId" in norm) return false

  return true
}

export const googleOAuthStrategy: CredentialStrategy<GoogleCredential> = {
  kind: "oauth",
  label: "OAuth Refresh Token",

  detect(raw: unknown): boolean {
    if (!raw || typeof raw !== "object") return false
    return isGoogleOAuthShape(raw as Record<string, unknown>)
  },

  validate(
    raw: unknown,
  ):
    | { valid: true; credential: GoogleCredential; email?: string }
    | { valid: false; error: string } {
    if (!raw || typeof raw !== "object") {
      return { valid: false, error: "Invalid JSON" }
    }

    const obj = normalizeGoogleRaw(raw as Record<string, unknown>)

    const requiredFields = [
      "refresh_token",
      "client_id",
      "client_secret",
    ] as const

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
      token_uri:
        typeof obj.token_uri === "string" ? obj.token_uri : undefined,
    }

    const email =
      typeof obj.email === "string" ? obj.email : undefined

    return { valid: true, credential, email }
  },

  async getAccessToken(credential: GoogleCredential): Promise<string> {
    const tokenUri =
      credential.token_uri || "https://oauth2.googleapis.com/token"
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credential.refresh_token,
        client_id: credential.client_id,
        client_secret: credential.client_secret,
      }),
    })
    if (!res.ok) throw new Error("Failed to refresh Google access token")
    const data = await res.json()
    if (!data.access_token)
      throw new Error("No access_token in refresh response")
    return data.access_token as string
  },

  canRefresh(): boolean {
    return true
  },

  minimalCredential(credential: GoogleCredential): GoogleCredential {
    return {
      provider: "google",
      credentialKind: "oauth",
      refresh_token: credential.refresh_token,
      client_id: credential.client_id,
      client_secret: credential.client_secret,
      token_uri: credential.token_uri,
    }
  },
}
