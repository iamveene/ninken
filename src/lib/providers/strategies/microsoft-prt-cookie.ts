import type { CredentialStrategy } from "../credential-strategy"
import type { MicrosoftPrtCookieCredential } from "../types"
import { exchangeAuthCodeForToken } from "./microsoft-auth-code-exchange"

function isPrtCookieShape(obj: Record<string, unknown>): boolean {
  // Explicit token_type marker
  if (obj.token_type === "prt_cookie") return true
  // Has the x-ms-RefreshTokenCredential key (the raw cookie header value)
  if (
    typeof obj["x-ms-RefreshTokenCredential"] === "string" &&
    !!obj["x-ms-RefreshTokenCredential"]
  )
    return true
  // Has prt_cookie field directly
  return typeof obj.prt_cookie === "string" && !!obj.prt_cookie
}

/**
 * Normalize PRT cookie credential from various input formats.
 */
function normalizePrtCookieFields(obj: Record<string, unknown>): {
  prt_cookie: string | undefined
  tenant_id: string | undefined
  client_id: string | undefined
} {
  const prt_cookie =
    (typeof obj.prt_cookie === "string" && obj.prt_cookie) ||
    (typeof obj["x-ms-RefreshTokenCredential"] === "string" &&
      obj["x-ms-RefreshTokenCredential"]) ||
    undefined
  const tenant_id =
    (typeof obj.tenant_id === "string" && obj.tenant_id) ||
    (typeof obj.tenantId === "string" && obj.tenantId) ||
    undefined
  const client_id =
    (typeof obj.client_id === "string" && obj.client_id) ||
    (typeof obj.clientId === "string" && obj.clientId) ||
    undefined
  return { prt_cookie, tenant_id, client_id }
}

export const microsoftPrtCookieStrategy: CredentialStrategy<MicrosoftPrtCookieCredential> =
  {
    kind: "prt-cookie",
    label: "PRT Cookie (SSO Injection)",

    detect(raw: unknown): boolean {
      if (!raw || typeof raw !== "object") return false
      return isPrtCookieShape(raw as Record<string, unknown>)
    },

    validate(
      raw: unknown,
    ):
      | {
          valid: true
          credential: MicrosoftPrtCookieCredential
          email?: string
        }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = raw as Record<string, unknown>
      const { prt_cookie, tenant_id, client_id } =
        normalizePrtCookieFields(obj)

      if (!prt_cookie) {
        return {
          valid: false,
          error:
            "Missing required field: prt_cookie (or x-ms-RefreshTokenCredential)",
        }
      }

      if (!tenant_id) {
        return {
          valid: false,
          error: "Missing required field: tenant_id",
        }
      }

      const credential: MicrosoftPrtCookieCredential = {
        provider: "microsoft",
        credentialKind: "prt-cookie",
        prt_cookie,
        tenant_id,
        client_id: client_id || undefined,
      }

      return { valid: true, credential }
    },

    async getAccessToken(
      credential: MicrosoftPrtCookieCredential,
    ): Promise<string> {
      return exchangeAuthCodeForToken({
        tenant: credential.tenant_id,
        clientId: credential.client_id,
        authorizeHeaders: {
          "x-ms-RefreshTokenCredential": credential.prt_cookie,
          Cookie: `x-ms-RefreshTokenCredential=${credential.prt_cookie}`,
        },
        strategyLabel: "PRT cookie SSO",
      })
    },

    canRefresh(): boolean {
      // PRT cookie is one-shot — cannot be reused for new tokens
      return false
    },

    minimalCredential(
      credential: MicrosoftPrtCookieCredential,
    ): MicrosoftPrtCookieCredential {
      return {
        provider: "microsoft",
        credentialKind: "prt-cookie",
        prt_cookie: credential.prt_cookie,
        tenant_id: credential.tenant_id,
        client_id: credential.client_id,
      }
    },
  }
