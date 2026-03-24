import type { VaultItem } from "./types"

export const REINJECT_SUPPORTED_TYPES = ["aws", "github", "gitlab", "slack", "gcp", "microsoft"] as const

export function buildRawCredential(item: VaultItem): unknown | null {
  switch (item.type) {
    case "github":
      return { provider: "github", credentialKind: "access-token", access_token: item.content }
    case "gitlab":
      return { provider: "gitlab", credentialKind: "access-token", access_token: item.content }
    case "gcp":
      if (item.subType === "api_key") return { provider: "gcp", credentialKind: "api-key", api_key: item.content }
      if (item.subType === "service_account_json") {
        try { return JSON.parse(item.content) } catch { return null }
      }
      return null
    case "aws":
      try {
        const parsed = JSON.parse(item.content)
        if (parsed.access_key_id && parsed.secret_access_key) {
          return { provider: "aws", credentialKind: "access-key", ...parsed }
        }
      } catch {
        // single field -- can't reinject
      }
      return null
    case "microsoft":
      if (item.subType === "refresh_token") {
        return { provider: "microsoft", refresh_token: item.content, client_id: "d3590ed6-52b3-4102-aeff-aad2292ab01c", tenant_id: "common" }
      }
      return null
    case "slack":
      return { provider: "slack", credentialKind: "api-token", access_token: item.content }
    case "pii":
    case "url":
    case "infrastructure":
      return null
    default:
      return null
  }
}

export function canReinject(item: VaultItem): boolean {
  return buildRawCredential(item) !== null
}
