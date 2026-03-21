import type { CredentialStrategy } from "../credential-strategy"
import type { GoogleServiceAccountCredential } from "../types"

function isServiceAccountShape(obj: Record<string, unknown>): boolean {
  return (
    obj.type === "service_account" &&
    typeof obj.private_key === "string" &&
    !!obj.private_key &&
    typeof obj.client_email === "string" &&
    !!obj.client_email
  )
}

/**
 * Base64url encode a Uint8Array (no padding).
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Base64url encode a UTF-8 string. */
function base64url(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str))
}

// Cache imported CryptoKeys by PEM fingerprint to avoid re-parsing on every token request
const keyCache = new Map<string, CryptoKey>()

/**
 * Import a PEM-encoded RSA private key as a CryptoKey for signing.
 * Caches the result so repeated calls with the same key skip the import.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cached = keyCache.get(pem)
  if (cached) return cached

  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\n\r\s]/g, "")

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )

  keyCache.set(pem, key)
  return key
}

/**
 * Create a signed JWT for Google service account authentication.
 * Uses Web Crypto API (available in Node 20+ and all modern browsers).
 */
async function createSignedJwt(
  credential: GoogleServiceAccountCredential,
  scopes: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss: credential.client_email,
    scope: scopes.join(" "),
    aud: credential.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1 hour
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const key = await importPrivateKey(credential.private_key)
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`
}

export const googleServiceAccountStrategy: CredentialStrategy<GoogleServiceAccountCredential> =
  {
    kind: "service-account",
    label: "Service Account Key",

    detect(raw: unknown): boolean {
      if (!raw || typeof raw !== "object") return false
      return isServiceAccountShape(raw as Record<string, unknown>)
    },

    validate(
      raw: unknown,
    ):
      | {
          valid: true
          credential: GoogleServiceAccountCredential
          email?: string
        }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = raw as Record<string, unknown>

      if (obj.type !== "service_account") {
        return { valid: false, error: "Not a service account key" }
      }

      if (typeof obj.private_key !== "string" || !obj.private_key) {
        return {
          valid: false,
          error: "Missing required field: private_key",
        }
      }

      if (typeof obj.client_email !== "string" || !obj.client_email) {
        return {
          valid: false,
          error: "Missing required field: client_email",
        }
      }

      const credential: GoogleServiceAccountCredential = {
        provider: "google",
        credentialKind: "service-account",
        client_email: obj.client_email as string,
        private_key: obj.private_key as string,
        private_key_id:
          typeof obj.private_key_id === "string"
            ? obj.private_key_id
            : "",
        project_id:
          typeof obj.project_id === "string" ? obj.project_id : "",
        token_uri:
          typeof obj.token_uri === "string" ? obj.token_uri : undefined,
      }

      return {
        valid: true,
        credential,
        email: credential.client_email,
      }
    },

    async getAccessToken(
      credential: GoogleServiceAccountCredential,
    ): Promise<string> {
      const tokenUri =
        credential.token_uri || "https://oauth2.googleapis.com/token"

      const assertion = await createSignedJwt(credential, [
        "https://www.googleapis.com/auth/cloud-platform",
      ])

      const res = await fetch(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "Token request failed")
        throw new Error(`Service account token request failed: ${text}`)
      }

      const data = await res.json()
      if (!data.access_token) {
        throw new Error("No access_token in service account response")
      }

      return data.access_token as string
    },

    canRefresh(): boolean {
      // Service account keys can always mint new tokens from the private key
      return true
    },

    minimalCredential(
      credential: GoogleServiceAccountCredential,
    ): GoogleServiceAccountCredential {
      return {
        provider: "google",
        credentialKind: "service-account",
        client_email: credential.client_email,
        private_key: credential.private_key,
        private_key_id: credential.private_key_id,
        project_id: credential.project_id,
        token_uri: credential.token_uri,
      }
    },
  }
