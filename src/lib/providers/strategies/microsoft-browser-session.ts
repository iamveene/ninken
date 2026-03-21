import type { CredentialStrategy } from "../credential-strategy"
import type { MicrosoftBrowserSessionCredential } from "../types"
import { exchangeAuthCodeForToken } from "./microsoft-auth-code-exchange"

function isBrowserSessionShape(obj: Record<string, unknown>): boolean {
  // Explicit token_type marker
  if (obj.token_type === "browser_session") return true
  // Has the estsauthpersistent field (the raw cookie value)
  return (
    typeof obj.estsauthpersistent === "string" && !!obj.estsauthpersistent
  )
}

export const microsoftBrowserSessionStrategy: CredentialStrategy<MicrosoftBrowserSessionCredential> =
  {
    kind: "browser-session",
    label: "Browser Session (ESTSAUTHPERSISTENT)",

    detect(raw: unknown): boolean {
      if (!raw || typeof raw !== "object") return false
      return isBrowserSessionShape(raw as Record<string, unknown>)
    },

    validate(
      raw: unknown,
    ):
      | {
          valid: true
          credential: MicrosoftBrowserSessionCredential
          email?: string
        }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = raw as Record<string, unknown>

      if (
        typeof obj.estsauthpersistent !== "string" ||
        !obj.estsauthpersistent
      ) {
        return {
          valid: false,
          error: "Missing required field: estsauthpersistent",
        }
      }

      const tenantId =
        (typeof obj.tenant_id === "string" && obj.tenant_id) ||
        (typeof obj.tenantId === "string" && obj.tenantId) ||
        undefined
      const clientId =
        (typeof obj.client_id === "string" && obj.client_id) ||
        (typeof obj.clientId === "string" && obj.clientId) ||
        undefined

      const credential: MicrosoftBrowserSessionCredential = {
        provider: "microsoft",
        credentialKind: "browser-session",
        estsauthpersistent: obj.estsauthpersistent as string,
        tenant_id: tenantId || undefined,
        client_id: clientId || undefined,
      }

      return { valid: true, credential }
    },

    async getAccessToken(
      credential: MicrosoftBrowserSessionCredential,
    ): Promise<string> {
      return exchangeAuthCodeForToken({
        tenant: credential.tenant_id || "common",
        clientId: credential.client_id,
        authorizeHeaders: {
          Cookie: `ESTSAUTHPERSISTENT=${credential.estsauthpersistent}`,
        },
        strategyLabel: "Browser session silent auth",
      })
    },

    canRefresh(): boolean {
      // Browser session cookies cannot be refreshed programmatically
      return false
    },

    minimalCredential(
      credential: MicrosoftBrowserSessionCredential,
    ): MicrosoftBrowserSessionCredential {
      return {
        provider: "microsoft",
        credentialKind: "browser-session",
        estsauthpersistent: credential.estsauthpersistent,
        tenant_id: credential.tenant_id,
        client_id: credential.client_id,
      }
    },
  }
