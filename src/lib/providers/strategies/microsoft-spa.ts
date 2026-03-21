import type { ClientRefreshableStrategy } from "../client-refreshable-strategy"
import type { MicrosoftSpaCredential } from "../types"
import { normalizeRaw } from "./microsoft-oauth"
import { decodeJwtPayload } from "../../microsoft"

const LOGIN_BASE = "https://login.microsoftonline.com"

/** Known Microsoft SPA-registered client IDs */
const SPA_CLIENT_IDS = new Set([
  "9199bf20-a13f-4107-85dc-02114787ef48", // One Outlook Web
  "5e3ce6c0-2b1f-4285-8d4b-75ee78787346", // Microsoft Teams Web Client
])

/** Check whether a client_id is a known SPA client */
export function isSpaClientId(clientId: string): boolean {
  return SPA_CLIENT_IDS.has(clientId)
}

export const microsoftSpaStrategy: ClientRefreshableStrategy<MicrosoftSpaCredential> =
  {
    kind: "spa",
    label: "SPA Token (OWA)",
    requiresBrowserContext: true,

    detect(raw: unknown): boolean {
      if (!raw || typeof raw !== "object") return false
      const obj = normalizeRaw(raw as Record<string, unknown>)

      // Must have a refresh_token
      if (typeof obj.refresh_token !== "string" || !obj.refresh_token)
        return false

      // Explicit SPA marker
      if (obj.token_type === "spa" || obj.credentialKind === "spa")
        return true

      // Known SPA client ID
      if (
        typeof obj.client_id === "string" &&
        isSpaClientId(obj.client_id)
      )
        return true

      return false
    },

    validate(
      raw: unknown,
    ):
      | { valid: true; credential: MicrosoftSpaCredential; email?: string }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = normalizeRaw(raw as Record<string, unknown>)

      if (typeof obj.refresh_token !== "string" || !obj.refresh_token) {
        return { valid: false, error: "Missing required field: refresh_token" }
      }

      const tenantId = (obj.tenant_id || obj.tenantId) as string | undefined
      if (!tenantId) {
        return { valid: false, error: "Missing required field: tenant_id" }
      }

      const clientId =
        typeof obj.client_id === "string" && obj.client_id
          ? obj.client_id
          : "9199bf20-a13f-4107-85dc-02114787ef48" // Default to OWA

      const credential: MicrosoftSpaCredential = {
        provider: "microsoft",
        credentialKind: "spa",
        refresh_token: obj.refresh_token as string,
        client_id: clientId,
        tenant_id: tenantId,
        access_token:
          typeof obj.access_token === "string" ? obj.access_token : undefined,
        scope: Array.isArray(obj.scope)
          ? (obj.scope as string[])
          : typeof obj.scope === "string"
            ? (obj.scope as string).split(" ").filter(Boolean)
            : undefined,
        token_uri:
          typeof obj.token_uri === "string" ? obj.token_uri : undefined,
        account:
          typeof obj.account === "string" ? obj.account : undefined,
      }

      // If access_token is present, decode expires_at from JWT
      if (credential.access_token) {
        const payload = decodeJwtPayload(credential.access_token)
        if (payload?.exp) {
          credential.expires_at = payload.exp as number
        }
      }

      const email =
        typeof obj.email === "string"
          ? obj.email
          : typeof obj.account === "string"
            ? obj.account
            : undefined

      return { valid: true, credential, email }
    },

    getAccessToken(credential: MicrosoftSpaCredential): Promise<string> {
      // Server-side: return cached access token if available and not expired
      if (credential.access_token) {
        const now = Math.floor(Date.now() / 1000)
        if (!credential.expires_at || credential.expires_at > now + 300) {
          return Promise.resolve(credential.access_token)
        }
      }
      // Server-side cannot refresh SPA tokens — throw a clear error
      return Promise.reject(
        new Error(
          "SPA token expired — requires browser-side refresh (AADSTS9002327)"
        )
      )
    },

    canRefresh(): boolean {
      // Server-side: cannot refresh (SPA-bound). Client-side uses clientRefresh() instead.
      return false
    },

    needsRefresh(credential: MicrosoftSpaCredential): boolean {
      if (!credential.access_token || !credential.expires_at) return true
      const now = Math.floor(Date.now() / 1000)
      // Refresh when within 10 minutes of expiry
      return credential.expires_at - now < 600
    },

    async clientRefresh(
      credential: MicrosoftSpaCredential,
    ): Promise<{
      access_token: string
      refresh_token: string
      expires_in: number
    }> {
      const tokenUri =
        credential.token_uri ||
        `${LOGIN_BASE}/${credential.tenant_id}/oauth2/v2.0/token`

      const res = await fetch(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credential.refresh_token,
          client_id: credential.client_id,
          scope: "https://graph.microsoft.com/.default offline_access",
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "SPA token refresh failed")
        throw new Error(`SPA token refresh failed: ${text}`)
      }

      const data = await res.json()
      if (!data.access_token) {
        throw new Error("No access_token in SPA refresh response")
      }

      return {
        access_token: data.access_token as string,
        refresh_token: (data.refresh_token as string) || credential.refresh_token,
        expires_in: (data.expires_in as number) || 3600,
      }
    },

    minimalCredential(
      credential: MicrosoftSpaCredential,
    ): MicrosoftSpaCredential {
      // CRITICAL: refresh_token is deliberately EXCLUDED from minimal.
      // It stays only in IndexedDB, never goes into the cookie.
      // The cookie gets the access_token so API routes can use it directly.
      return {
        provider: "microsoft",
        credentialKind: "spa",
        refresh_token: "", // Empty — never serialize to cookie
        client_id: credential.client_id,
        tenant_id: credential.tenant_id,
        access_token: credential.access_token,
        expires_at: credential.expires_at,
        account: credential.account,
      }
    },
  }
