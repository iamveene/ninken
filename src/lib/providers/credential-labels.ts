import type { CredentialKind, ProviderId } from "./types"

const CREDENTIAL_LABELS: Record<string, string> = {
  "microsoft:oauth": "OAuth Refresh Token",
  "microsoft:foci": "FOCI Token",
  "microsoft:service-principal": "Service Principal",
  "microsoft:prt": "Primary Refresh Token",
  "microsoft:prt-cookie": "PRT Cookie",
  "microsoft:browser-session": "Browser Session",
  "microsoft:access-token": "Access Token",
  "google:oauth": "OAuth Refresh Token",
  "google:service-account": "Service Account",
  "google:access-token": "Access Token",
  "github:access-token": "Personal Access Token",
  "gitlab:access-token": "Personal Access Token",
  "slack:browser-session": "Browser Session",
  "slack:api-token": "API Token",
  "aws:access-token": "IAM Access Key",
  "gcp:api-key": "API Key",
}

const SHORT_LABELS: Record<string, string> = {
  "microsoft:oauth": "OAuth",
  "microsoft:foci": "FOCI",
  "microsoft:service-principal": "SP",
  "microsoft:prt": "PRT",
  "microsoft:prt-cookie": "PRT Cookie",
  "microsoft:browser-session": "Browser",
  "microsoft:access-token": "AT",
  "google:oauth": "OAuth",
  "google:service-account": "SA",
  "google:access-token": "AT",
  "github:access-token": "PAT",
  "gitlab:access-token": "PAT",
  "slack:browser-session": "Browser",
  "slack:api-token": "API",
  "aws:access-token": "IAM Key",
  "gcp:api-key": "API Key",
}

export function getCredentialLabel(provider: ProviderId, kind?: CredentialKind): string {
  if (!kind) return ""
  return CREDENTIAL_LABELS[`${provider}:${kind}`] ?? kind
}

export function getCredentialShortLabel(provider: ProviderId, kind?: CredentialKind): string {
  if (!kind) return ""
  return SHORT_LABELS[`${provider}:${kind}`] ?? kind
}
