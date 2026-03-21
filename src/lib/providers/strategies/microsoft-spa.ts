import type { ClientRefreshableStrategy } from "../client-refreshable-strategy"
import type { MicrosoftSpaCredential, ResourceToken } from "../types"
import { resolveResourceToken } from "../types"
import { normalizeRaw } from "./microsoft-oauth"
import { decodeJwtPayload } from "../../microsoft"
import { isSpaClientId, getSpaClient } from "../spa-client-registry"

const LOGIN_BASE = "https://login.microsoftonline.com"

/** Create an Error tagged as origin-bound so callers can back off without retry */
function originBoundError(message: string): Error & { originBound: true } {
  const err = new Error(message) as Error & { originBound: true }
  err.originBound = true
  return err
}

export { isSpaClientId }

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

      if (obj.resource_tokens && typeof obj.resource_tokens === "object") {
        const rawRts = obj.resource_tokens as Record<
          string,
          { access_token?: string; expires_at?: number; expires_in?: number; scope?: string[] }
        >
        const parsed: Record<string, ResourceToken> = {}
        for (const [resource, rt] of Object.entries(rawRts)) {
          if (!rt || typeof rt.access_token !== "string") continue
          let expiresAt = typeof rt.expires_at === "number" ? rt.expires_at : 0
          if (!expiresAt) {
            // Decode from JWT if not provided
            const rtPayload = decodeJwtPayload(rt.access_token)
            expiresAt = rtPayload?.exp
              ? (rtPayload.exp as number)
              : typeof rt.expires_in === "number"
                ? Math.floor(Date.now() / 1000) + rt.expires_in
                : Math.floor(Date.now() / 1000) + 3600
          }
          parsed[resource] = {
            access_token: rt.access_token,
            expires_at: expiresAt,
            scope: Array.isArray(rt.scope) ? rt.scope : [],
            resource,
          }
        }
        if (Object.keys(parsed).length > 0) {
          credential.resource_tokens = parsed
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

    getAccessToken(
      credential: MicrosoftSpaCredential,
      resource?: string,
    ): Promise<string> {
      const now = Math.floor(Date.now() / 1000)

      // If a specific resource is requested, check resource_tokens first
      if (resource && credential.resource_tokens) {
        const rt = resolveResourceToken(credential.resource_tokens, resource)
        if (rt && rt.expires_at > now + 300) {
          return Promise.resolve(rt.access_token)
        }
      }

      // Fall back to primary access token
      if (credential.access_token) {
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
      if (credential.expires_at - now < 600) return true
      if (credential.resource_tokens) {
        for (const rt of Object.values(credential.resource_tokens)) {
          if (rt.expires_at - now < 600) return true
        }
      }
      return false
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

      // Use the registry's defaultResource for the scope, falling back to Graph
      const clientEntry = getSpaClient(credential.client_id)
      const defaultResource =
        clientEntry?.defaultResource || "https://graph.microsoft.com/.default"

      let res: Response
      try {
        res = await fetch(tokenUri, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: credential.refresh_token,
            client_id: credential.client_id,
            scope: `${defaultResource} offline_access`,
          }),
        })
      } catch {
        // CORS-blocked requests throw a TypeError ("Failed to fetch") before
        // we can read the response body. Treat any network-level failure on
        // the Microsoft token endpoint as origin-bound — this is the expected
        // behaviour for SPA tokens used outside their original origin.
        throw originBoundError(
          "SPA token refresh blocked (CORS/network error on token endpoint)"
        )
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "SPA token refresh failed")

        // Detect origin-bound errors: AADSTS9002313 (cross-origin) or
        // AADSTS9002327 (SPA-only redemption). These mean the RT can only
        // be used from the original SPA origin.
        if (
          text.includes("AADSTS9002313") ||
          text.includes("AADSTS9002327")
        ) {
          throw originBoundError(`SPA token refresh failed: ${text}`)
        }

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
      // resource_tokens are also excluded — they're too large for the cookie.
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
