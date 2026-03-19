import type { CredentialStrategy } from "../credential-strategy"
import type { MicrosoftServicePrincipalCredential } from "../types"

function isServicePrincipalShape(obj: Record<string, unknown>): boolean {
  const hasClientSecret =
    typeof obj.client_secret === "string" && !!obj.client_secret
  const hasClientId =
    typeof obj.client_id === "string" && !!obj.client_id
  const hasTenantId =
    typeof obj.tenant_id === "string" || typeof obj.tenantId === "string"
  const hasRefreshToken =
    typeof obj.refresh_token === "string" && !!obj.refresh_token

  // Service principal: client_secret + client_id + tenant_id, no refresh_token
  return hasClientSecret && hasClientId && hasTenantId && !hasRefreshToken
}

export const microsoftServicePrincipalStrategy: CredentialStrategy<MicrosoftServicePrincipalCredential> =
  {
    kind: "service-principal",
    label: "Service Principal (Client Credentials)",

    detect(raw: unknown): boolean {
      if (!raw || typeof raw !== "object") return false
      return isServicePrincipalShape(raw as Record<string, unknown>)
    },

    validate(
      raw: unknown,
    ):
      | {
          valid: true
          credential: MicrosoftServicePrincipalCredential
          email?: string
        }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = raw as Record<string, unknown>

      if (typeof obj.client_id !== "string" || !obj.client_id) {
        return {
          valid: false,
          error: "Missing required field: client_id",
        }
      }

      if (typeof obj.client_secret !== "string" || !obj.client_secret) {
        return {
          valid: false,
          error: "Missing required field: client_secret",
        }
      }

      const tenantId = (obj.tenant_id || obj.tenantId) as
        | string
        | undefined
      if (!tenantId) {
        return {
          valid: false,
          error: "Missing required field: tenant_id",
        }
      }

      const credential: MicrosoftServicePrincipalCredential = {
        provider: "microsoft",
        credentialKind: "service-principal",
        client_id: obj.client_id as string,
        client_secret: obj.client_secret as string,
        tenant_id: tenantId,
        token_uri:
          typeof obj.token_uri === "string"
            ? obj.token_uri
            : undefined,
      }

      return { valid: true, credential }
    },

    async getAccessToken(
      credential: MicrosoftServicePrincipalCredential,
    ): Promise<string> {
      const tokenUri =
        credential.token_uri ||
        `https://login.microsoftonline.com/${credential.tenant_id}/oauth2/v2.0/token`

      const res = await fetch(tokenUri, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: credential.client_id,
          client_secret: credential.client_secret,
          scope: "https://graph.microsoft.com/.default",
        }),
      })

      if (!res.ok) {
        const text = await res
          .text()
          .catch(() => "Token acquisition failed")
        throw new Error(
          `Service principal token acquisition failed: ${text}`,
        )
      }

      const data = await res.json()
      if (!data.access_token) {
        throw new Error(
          "No access_token in client_credentials response",
        )
      }
      return data.access_token as string
    },

    canRefresh(): boolean {
      // Service principals don't "refresh" — they request new tokens each time
      return false
    },

    minimalCredential(
      credential: MicrosoftServicePrincipalCredential,
    ): MicrosoftServicePrincipalCredential {
      return {
        provider: "microsoft",
        credentialKind: "service-principal",
        client_id: credential.client_id,
        client_secret: credential.client_secret,
        tenant_id: credential.tenant_id,
        token_uri: credential.token_uri,
      }
    },
  }
