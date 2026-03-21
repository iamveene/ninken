import type { CredentialStrategy } from "../credential-strategy"
import type { MicrosoftCredential } from "../types"
import {
  getAccessToken as msGetAccessToken,
  decodeJwtPayload,
} from "../../microsoft"
import { isSpaClientId } from "../spa-client-registry"

// Teams FOCI client ID (public client, no secret needed)
const TEAMS_FOCI_CLIENT_ID = "1fec8e78-bce4-4aaf-ab1b-5451cc387264"

export { TEAMS_FOCI_CLIENT_ID }

function isMicrosoftOAuthShape(obj: Record<string, unknown>): boolean {
  // Must have a refresh_token for OAuth
  if (typeof obj.refresh_token !== "string" || !obj.refresh_token)
    return false

  // Defer to SPA strategy if the client_id is a known SPA client
  if (typeof obj.client_id === "string" && isSpaClientId(obj.client_id))
    return false

  // Explicit SPA markers — let SPA strategy handle these
  if (obj.token_type === "spa" || obj.credentialKind === "spa")
    return false

  // Explicit platform marker
  if (obj.platform === "microsoft" || obj.provider === "microsoft")
    return true

  const hasTenantId =
    typeof obj.tenant_id === "string" || typeof obj.tenantId === "string"

  // Positive: has tenant_id
  if (hasTenantId) return true

  // Positive: token_uri contains Microsoft endpoint
  const tokenUri =
    typeof obj.token_uri === "string" ? obj.token_uri : ""
  if (tokenUri.includes("login.microsoftonline.com")) return true

  return false
}

/**
 * Normalize the raw credential JSON, handling various formats:
 * - Direct: { refresh_token, client_id, tenant_id, ... }
 * - Richter token: { accessToken, refreshToken, tenantId, clientId, ... }
 * - Nested: { token: { refresh_token, ... }, tenant_id, ... }
 */
export function normalizeRaw(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  // Richter / camelCase format
  if (typeof raw.refreshToken === "string") {
    return {
      refresh_token: raw.refreshToken,
      client_id:
        raw.clientId || raw.client_id || TEAMS_FOCI_CLIENT_ID,
      tenant_id: raw.tenantId || raw.tenant_id,
      access_token: raw.accessToken || raw.access_token,
      scope: raw.scope,
      foci: raw.foci,
      account:
        raw.account || raw.userId || raw.userPrincipalName,
    }
  }

  // Nested token format
  if (raw.token && typeof raw.token === "object") {
    const inner = raw.token as Record<string, unknown>
    return {
      ...inner,
      tenant_id:
        inner.tenant_id || raw.tenant_id || raw.tenantId,
      client_id:
        inner.client_id || raw.client_id || TEAMS_FOCI_CLIENT_ID,
    }
  }

  // Azure CLI MSAL cache: { AccessToken: {...}, RefreshToken: {...}, Account: {...}, ... }
  if (raw.RefreshToken && typeof raw.RefreshToken === "object") {
    const rtEntries = Object.values(
      raw.RefreshToken as Record<string, Record<string, unknown>>,
    )
    if (rtEntries.length > 0) {
      const first = rtEntries[0]
      return {
        refresh_token: first.secret as string,
        client_id:
          (first.client_id as string) || TEAMS_FOCI_CLIENT_ID,
        tenant_id:
          (first.realm as string) || (first.environment as string),
        foci: first.family_id === "1",
        account: first.username as string,
      }
    }
  }

  // Azure PowerShell: { Contexts: { "Default": { Account: { Id, Tenants }, ... } } }
  if (raw.Contexts && typeof raw.Contexts === "object") {
    const contexts = raw.Contexts as Record<
      string,
      Record<string, unknown>
    >
    const firstKey = Object.keys(contexts)[0]
    if (firstKey) {
      const ctx = contexts[firstKey]
      const account = ctx.Account as
        | Record<string, unknown>
        | undefined
      const tenant =
        (account?.Tenants as string[])?.[0] || ""
      return {
        provider: "microsoft",
        tenant_id: tenant,
        client_id: TEAMS_FOCI_CLIENT_ID,
        refresh_token: "",
        account: account?.Id as string,
      }
    }
  }

  return raw
}

export const microsoftOAuthStrategy: CredentialStrategy<MicrosoftCredential> =
  {
    kind: "oauth",
    label: "OAuth / FOCI Refresh Token",

    detect(raw: unknown): boolean {
      // Raw JWT string: check for Microsoft-specific claims
      if (typeof raw === "string" && raw.startsWith("eyJ")) {
        const payload = decodeJwtPayload(raw)
        if (payload) {
          return !!(
            payload.tid ||
            (typeof payload.iss === "string" &&
              payload.iss.includes("sts.windows.net"))
          )
        }
        return false
      }
      if (!raw || typeof raw !== "object") return false
      const obj = normalizeRaw(raw as Record<string, unknown>)
      return isMicrosoftOAuthShape(obj)
    },

    validate(
      raw: unknown,
    ):
      | {
          valid: true
          credential: MicrosoftCredential
          email?: string
        }
      | { valid: false; error: string } {
      if (!raw || typeof raw !== "object") {
        return { valid: false, error: "Invalid JSON" }
      }

      const obj = normalizeRaw(raw as Record<string, unknown>)

      if (
        typeof obj.refresh_token !== "string" ||
        !obj.refresh_token
      ) {
        return {
          valid: false,
          error: "Missing required field: refresh_token",
        }
      }

      // tenant_id is required
      const tenantId = (obj.tenant_id || obj.tenantId) as
        | string
        | undefined
      if (!tenantId) {
        return {
          valid: false,
          error: "Missing required field: tenant_id",
        }
      }

      // Default client_id to Teams FOCI if not provided
      const clientId =
        typeof obj.client_id === "string" && obj.client_id
          ? obj.client_id
          : TEAMS_FOCI_CLIENT_ID

      const isFoci = obj.foci === true || obj.foci === "1"

      const credential: MicrosoftCredential = {
        provider: "microsoft",
        credentialKind: isFoci ? "foci" : "oauth",
        refresh_token: obj.refresh_token as string,
        client_id: clientId,
        tenant_id: tenantId,
        access_token:
          typeof obj.access_token === "string"
            ? obj.access_token
            : undefined,
        scope: Array.isArray(obj.scope)
          ? (obj.scope as string[])
          : typeof obj.scope === "string"
            ? (obj.scope as string).split(" ").filter(Boolean)
            : undefined,
        token_uri:
          typeof obj.token_uri === "string"
            ? obj.token_uri
            : undefined,
        account:
          typeof obj.account === "string"
            ? obj.account
            : undefined,
        foci: isFoci,
      }

      const email =
        typeof obj.email === "string"
          ? obj.email
          : typeof obj.account === "string"
            ? obj.account
            : undefined

      return { valid: true, credential, email }
    },

    async getAccessToken(
      credential: MicrosoftCredential,
    ): Promise<string> {
      return msGetAccessToken(credential)
    },

    canRefresh(credential: MicrosoftCredential): boolean {
      return (
        credential.credentialKind !== "access-token" &&
        !!credential.refresh_token
      )
    },

    minimalCredential(
      credential: MicrosoftCredential,
    ): MicrosoftCredential {
      return {
        provider: "microsoft",
        credentialKind: credential.credentialKind,
        refresh_token: credential.refresh_token,
        client_id: credential.client_id,
        tenant_id: credential.tenant_id,
        token_uri: credential.token_uri,
      }
    },
  }
