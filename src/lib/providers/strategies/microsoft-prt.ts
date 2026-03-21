import type { CredentialStrategy } from "../credential-strategy"
import type { MicrosoftPrtCredential } from "../types"
import { TEAMS_FOCI_CLIENT_ID } from "./microsoft-oauth"
import { base64urlEncode, base64url, base64Decode } from "./crypto-utils"

// Cache imported HMAC keys by session_key fingerprint
const hmacKeyCache = new Map<string, CryptoKey>()

/**
 * Import a base64-encoded session key as an HMAC-SHA256 CryptoKey.
 * Caches the result so repeated calls skip the import.
 */
async function importSessionKey(sessionKeyB64: string): Promise<CryptoKey> {
  const cached = hmacKeyCache.get(sessionKeyB64)
  if (cached) return cached

  const keyBytes = base64Decode(sessionKeyB64)
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  hmacKeyCache.set(sessionKeyB64, key)
  return key
}

/**
 * Build a signed JWT assertion for PRT exchange.
 * Uses HMAC-SHA256 with the PRT session key.
 */
async function buildPrtAssertion(
  credential: MicrosoftPrtCredential,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const clientId = credential.client_id || TEAMS_FOCI_CLIENT_ID

  const header = { alg: "HS256", ctx: credential.prt }
  const payload = {
    iss: clientId,
    iat: now,
    exp: now + 300,
    request_nonce: crypto.randomUUID(),
    scope: "openid",
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const key = await importSessionKey(credential.session_key)
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`
}

function isPrtShape(obj: Record<string, unknown>): boolean {
  // Explicit token_type marker
  if (obj.token_type === "prt") return true
  // Has prt + session_key fields (the raw PRT dump)
  return (
    typeof obj.prt === "string" &&
    !!obj.prt &&
    typeof obj.session_key === "string" &&
    !!obj.session_key
  )
}

export const microsoftPrtStrategy: CredentialStrategy<MicrosoftPrtCredential> =
  {
    kind: "prt",
    label: "Primary Refresh Token (PRT)",

    detect(raw: unknown): boolean {
      if (!raw || typeof raw !== "object") return false
      return isPrtShape(raw as Record<string, unknown>)
    },

    validate(
      raw: unknown,
    ):
      | {
          valid: true
          credential: MicrosoftPrtCredential
          email?: string
        }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = raw as Record<string, unknown>

      if (typeof obj.prt !== "string" || !obj.prt) {
        return {
          valid: false,
          error: "Missing required field: prt",
        }
      }

      if (typeof obj.session_key !== "string" || !obj.session_key) {
        return {
          valid: false,
          error: "Missing required field: session_key",
        }
      }

      const tenantId =
        (typeof obj.tenant_id === "string" && obj.tenant_id) ||
        (typeof obj.tenantId === "string" && obj.tenantId) ||
        undefined
      if (!tenantId) {
        return {
          valid: false,
          error: "Missing required field: tenant_id",
        }
      }

      const credential: MicrosoftPrtCredential = {
        provider: "microsoft",
        credentialKind: "prt",
        prt: obj.prt as string,
        session_key: obj.session_key as string,
        tenant_id: tenantId,
        client_id:
          typeof obj.client_id === "string" && obj.client_id
            ? obj.client_id
            : undefined,
      }

      return { valid: true, credential }
    },

    async getAccessToken(
      credential: MicrosoftPrtCredential,
    ): Promise<string> {
      const clientId = credential.client_id || TEAMS_FOCI_CLIENT_ID
      const tokenUri = `https://login.microsoftonline.com/${credential.tenant_id}/oauth2/v2.0/token`

      // Step 1: Exchange PRT for refresh_token via signed JWT assertion
      const assertion = await buildPrtAssertion(credential)

      const prtRes = await fetch(tokenUri, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
          client_id: clientId,
          scope: "https://graph.microsoft.com/.default openid",
        }),
      })

      if (!prtRes.ok) {
        const text = await prtRes
          .text()
          .catch(() => "PRT exchange failed")
        throw new Error(`PRT exchange failed: ${text}`)
      }

      const prtData = await prtRes.json()

      // The PRT exchange may return an access_token directly
      if (prtData.access_token) {
        return prtData.access_token as string
      }

      // Or a refresh_token that we exchange for an access_token
      if (!prtData.refresh_token) {
        throw new Error(
          "PRT exchange returned neither access_token nor refresh_token",
        )
      }

      // Step 2: Exchange refresh_token for access_token
      const rtRes = await fetch(tokenUri, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: prtData.refresh_token as string,
          client_id: clientId,
          scope: "https://graph.microsoft.com/.default",
        }),
      })

      if (!rtRes.ok) {
        const text = await rtRes
          .text()
          .catch(() => "Refresh token exchange failed")
        throw new Error(`PRT refresh token exchange failed: ${text}`)
      }

      const rtData = await rtRes.json()
      if (!rtData.access_token) {
        throw new Error(
          "No access_token in PRT refresh token exchange response",
        )
      }

      return rtData.access_token as string
    },

    canRefresh(): boolean {
      // PRT + session_key can derive new refresh tokens repeatedly
      return true
    },

    minimalCredential(
      credential: MicrosoftPrtCredential,
    ): MicrosoftPrtCredential {
      return {
        provider: "microsoft",
        credentialKind: "prt",
        prt: credential.prt,
        session_key: credential.session_key,
        tenant_id: credential.tenant_id,
        client_id: credential.client_id,
      }
    },
  }
