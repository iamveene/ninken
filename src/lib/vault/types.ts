export type VaultItemType = "aws" | "gcp" | "github" | "microsoft" | "slack" | "gitlab" | "generic" | "pii" | "url" | "infrastructure"

export type VaultItemSubType =
  | "access_key" | "secret_key" | "session_token"      // AWS
  | "pat" | "oauth_token" | "app_token"                  // GitHub/GitLab
  | "bot_token" | "user_token" | "webhook_url"           // Slack
  | "refresh_token" | "access_token" | "client_secret"   // Microsoft
  | "api_key" | "service_account_json"                    // GCP
  | "password" | "connection_string" | "private_key" | "other" // Generic
  | "email_address" | "phone_number" | "ssn" | "full_name" | "credit_card" // PII
  | "internal_endpoint" | "admin_panel" | "api_url" | "webhook_endpoint"   // URL
  | "hostname" | "ip_address" | "cloud_arn" | "database_connection_string" // Infrastructure

export const REINJECTABLE_TYPES: VaultItemType[] = ["aws", "gcp", "github", "microsoft", "slack", "gitlab", "generic"]

export type VaultSource = {
  provider: string
  service: string
  reference: string
  url?: string
}

export type VaultItem = {
  id: string
  content: string          // decrypted secret value
  type: VaultItemType
  subType?: VaultItemSubType
  source: VaultSource
  discoveredAt: string     // ISO date
  pattern: string          // pattern ID that found it
  confidence: number       // 0-1
  metadata: Record<string, unknown>
  reinjected: boolean
  reinjectedProfileId?: string
}

export type VaultStats = {
  total: number
  byType: Record<string, number>
  byProvider: Record<string, number>
  reinjected: number
}

export type ExtractionResult = {
  extracted: boolean
  value?: string
  type?: VaultItemType
  subType?: VaultItemSubType
  confidence?: number
  reason?: string
}
