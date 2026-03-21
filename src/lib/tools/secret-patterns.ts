/**
 * Secret Search patterns — 30+ regex patterns for detecting exposed credentials,
 * API keys, tokens, private keys, PII, and other sensitive data across services.
 *
 * Each pattern includes:
 * - id: unique identifier
 * - name: human-readable name
 * - regex: detection regex (applied to search result snippets)
 * - severity: critical | high | medium | low
 * - category: grouping for filter tabs
 * - description: what this pattern detects
 * - searchQuery: the query string to send to service APIs (Gmail search, Drive fullText, etc.)
 */

export type SecretSeverity = "critical" | "high" | "medium" | "low"

export type SecretCategory =
  | "cloud-keys"
  | "tokens"
  | "private-keys"
  | "credentials"
  | "connection-strings"
  | "pii"
  | "webhooks"

export type SecretPattern = {
  id: string
  name: string
  regex: RegExp
  severity: SecretSeverity
  category: SecretCategory
  description: string
  /** Query string to search service APIs (Gmail, Drive, etc.) */
  searchQuery: string
}

export const SECRET_CATEGORIES: Record<SecretCategory, { label: string; description: string }> = {
  "cloud-keys": {
    label: "Cloud Keys",
    description: "AWS, GCP, Azure access keys and service account credentials",
  },
  tokens: {
    label: "Tokens",
    description: "GitHub, GitLab, Slack, JWT, Bearer, and other API tokens",
  },
  "private-keys": {
    label: "Private Keys",
    description: "RSA, EC, DSA, SSH, and PGP private key material",
  },
  credentials: {
    label: "Credentials",
    description: "Passwords, Basic auth, .env patterns, and generic secrets",
  },
  "connection-strings": {
    label: "Connection Strings",
    description: "Database URLs, JDBC, Redis, and other connection strings",
  },
  pii: {
    label: "PII",
    description: "Social Security Numbers, credit card numbers, and personal data",
  },
  webhooks: {
    label: "Webhooks",
    description: "Slack, Discord, and other webhook URLs with embedded tokens",
  },
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // ── Cloud Keys ──────────────────────────────────────────────
  {
    id: "aws-access-key",
    name: "AWS Access Key ID",
    regex: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
    category: "cloud-keys",
    description: "AWS IAM access key ID (starts with AKIA)",
    searchQuery: "AKIA",
  },
  {
    id: "aws-secret-key",
    name: "AWS Secret Access Key",
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY|secret_access_key)\s*[=:]\s*[A-Za-z0-9/+=]{40}/,
    severity: "critical",
    category: "cloud-keys",
    description: "AWS secret access key (40-char base64 value)",
    searchQuery: "aws_secret_access_key OR AWS_SECRET_ACCESS_KEY",
  },
  {
    id: "gcp-api-key",
    name: "Google API Key",
    regex: /AIza[0-9A-Za-z_-]{35}/,
    severity: "critical",
    category: "cloud-keys",
    description: "Google Cloud / Firebase API key (starts with AIza)",
    searchQuery: "AIza",
  },
  {
    id: "gcp-service-account",
    name: "GCP Service Account Key",
    regex: /"type"\s*:\s*"service_account"/,
    severity: "critical",
    category: "cloud-keys",
    description: "Google Cloud service account JSON key file",
    searchQuery: "service_account private_key_id",
  },
  {
    id: "azure-client-secret",
    name: "Azure Client Secret",
    regex: /(?:client_secret|AZURE_CLIENT_SECRET)\s*[=:]\s*[A-Za-z0-9~._-]{34,}/,
    severity: "critical",
    category: "cloud-keys",
    description: "Azure AD / Entra ID client secret credential",
    searchQuery: "client_secret AZURE_CLIENT_SECRET",
  },
  {
    id: "azure-sas-token",
    name: "Azure SAS Token",
    regex: /(?:sv=|sig=)[A-Za-z0-9%+/=]{20,}/,
    severity: "high",
    category: "cloud-keys",
    description: "Azure Shared Access Signature token",
    searchQuery: "SharedAccessSignature sig=",
  },

  // ── Tokens ──────────────────────────────────────────────────
  {
    id: "github-pat",
    name: "GitHub Personal Access Token",
    regex: /ghp_[A-Za-z0-9]{36}/,
    severity: "critical",
    category: "tokens",
    description: "GitHub personal access token (ghp_ prefix)",
    searchQuery: "ghp_",
  },
  {
    id: "github-oauth",
    name: "GitHub OAuth Token",
    regex: /gho_[A-Za-z0-9]{36}/,
    severity: "critical",
    category: "tokens",
    description: "GitHub OAuth access token (gho_ prefix)",
    searchQuery: "gho_",
  },
  {
    id: "github-app",
    name: "GitHub App Token",
    regex: /ghs_[A-Za-z0-9]{36}/,
    severity: "critical",
    category: "tokens",
    description: "GitHub App installation token (ghs_ prefix)",
    searchQuery: "ghs_",
  },
  {
    id: "github-fine-grained",
    name: "GitHub Fine-Grained PAT",
    regex: /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/,
    severity: "critical",
    category: "tokens",
    description: "GitHub fine-grained personal access token",
    searchQuery: "github_pat_",
  },
  {
    id: "gitlab-pat",
    name: "GitLab Personal Access Token",
    regex: /glpat-[A-Za-z0-9_-]{20,}/,
    severity: "critical",
    category: "tokens",
    description: "GitLab personal access token (glpat- prefix)",
    searchQuery: "glpat-",
  },
  {
    id: "gitlab-runner",
    name: "GitLab Runner Token",
    regex: /GR1348941[A-Za-z0-9_-]{20,}/,
    severity: "high",
    category: "tokens",
    description: "GitLab CI runner registration token",
    searchQuery: "GR1348941",
  },
  {
    id: "slack-bot-token",
    name: "Slack Bot Token",
    regex: /xoxb-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{24,}/,
    severity: "critical",
    category: "tokens",
    description: "Slack bot OAuth token (xoxb- prefix)",
    searchQuery: "xoxb-",
  },
  {
    id: "slack-user-token",
    name: "Slack User Token",
    regex: /xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{32}/,
    severity: "critical",
    category: "tokens",
    description: "Slack user OAuth token (xoxp- prefix)",
    searchQuery: "xoxp-",
  },
  {
    id: "slack-session-token",
    name: "Slack Session Token",
    regex: /xoxs-[0-9A-Za-z._-]{50,}/,
    severity: "critical",
    category: "tokens",
    description: "Slack session token (xoxs- prefix)",
    searchQuery: "xoxs-",
  },
  {
    id: "jwt-token",
    name: "JWT Token",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    severity: "high",
    category: "tokens",
    description: "JSON Web Token (base64 header.payload.signature)",
    searchQuery: "eyJhbG",
  },
  {
    id: "bearer-token",
    name: "Bearer Token in Header",
    regex: /(?:Authorization|authorization)\s*[:=]\s*Bearer\s+[A-Za-z0-9._~+/=-]{20,}/,
    severity: "high",
    category: "tokens",
    description: "HTTP Authorization header with Bearer token",
    searchQuery: "Authorization Bearer",
  },
  {
    id: "stripe-secret-key",
    name: "Stripe Secret Key",
    regex: /sk_live_[A-Za-z0-9]{24,}/,
    severity: "critical",
    category: "tokens",
    description: "Stripe live-mode secret API key",
    searchQuery: "sk_live_",
  },
  {
    id: "stripe-test-key",
    name: "Stripe Test Key",
    regex: /sk_test_[A-Za-z0-9]{24,}/,
    severity: "medium",
    category: "tokens",
    description: "Stripe test-mode secret API key",
    searchQuery: "sk_test_",
  },
  {
    id: "sendgrid-api-key",
    name: "SendGrid API Key",
    regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,
    severity: "critical",
    category: "tokens",
    description: "SendGrid API key (SG. prefix)",
    searchQuery: "SG.",
  },
  {
    id: "npm-token",
    name: "npm Access Token",
    regex: /npm_[A-Za-z0-9]{36}/,
    severity: "high",
    category: "tokens",
    description: "npm registry access token",
    searchQuery: "npm_",
  },

  // ── Private Keys ────────────────────────────────────────────
  {
    id: "rsa-private-key",
    name: "RSA Private Key",
    regex: /-----BEGIN RSA PRIVATE KEY-----/,
    severity: "critical",
    category: "private-keys",
    description: "PEM-encoded RSA private key",
    searchQuery: "BEGIN RSA PRIVATE KEY",
  },
  {
    id: "ec-private-key",
    name: "EC Private Key",
    regex: /-----BEGIN EC PRIVATE KEY-----/,
    severity: "critical",
    category: "private-keys",
    description: "PEM-encoded elliptic curve private key",
    searchQuery: "BEGIN EC PRIVATE KEY",
  },
  {
    id: "generic-private-key",
    name: "Generic Private Key",
    regex: /-----BEGIN PRIVATE KEY-----/,
    severity: "critical",
    category: "private-keys",
    description: "PEM-encoded PKCS#8 private key",
    searchQuery: "BEGIN PRIVATE KEY",
  },
  {
    id: "ssh-private-key",
    name: "SSH Private Key",
    regex: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    severity: "critical",
    category: "private-keys",
    description: "OpenSSH-format private key",
    searchQuery: "BEGIN OPENSSH PRIVATE KEY",
  },
  {
    id: "pgp-private-key",
    name: "PGP Private Key",
    regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    severity: "critical",
    category: "private-keys",
    description: "PGP/GPG private key block",
    searchQuery: "BEGIN PGP PRIVATE KEY",
  },
  {
    id: "dsa-private-key",
    name: "DSA Private Key",
    regex: /-----BEGIN DSA PRIVATE KEY-----/,
    severity: "critical",
    category: "private-keys",
    description: "PEM-encoded DSA private key",
    searchQuery: "BEGIN DSA PRIVATE KEY",
  },

  // ── Credentials ─────────────────────────────────────────────
  {
    id: "basic-auth",
    name: "Basic Auth Header",
    regex: /(?:Authorization|authorization)\s*[:=]\s*Basic\s+[A-Za-z0-9+/=]{10,}/,
    severity: "high",
    category: "credentials",
    description: "HTTP Basic authentication header (base64-encoded credentials)",
    searchQuery: "Authorization Basic",
  },
  {
    id: "env-password",
    name: "Password in .env",
    regex: /(?:PASSWORD|PASSWD|DB_PASS|DB_PASSWORD|ADMIN_PASSWORD)\s*=\s*\S{4,}/i,
    severity: "critical",
    category: "credentials",
    description: "Password assignment in environment variable format",
    searchQuery: "PASSWORD= OR DB_PASS= OR ADMIN_PASSWORD=",
  },
  {
    id: "env-secret",
    name: "Secret in .env",
    regex: /(?:SECRET|SECRET_KEY|APP_SECRET|API_SECRET)\s*=\s*\S{8,}/i,
    severity: "critical",
    category: "credentials",
    description: "Secret key assignment in environment variable format",
    searchQuery: "SECRET_KEY= OR APP_SECRET= OR API_SECRET=",
  },
  {
    id: "env-api-key",
    name: "API Key in .env",
    regex: /(?:API_KEY|APIKEY|ACCESS_KEY)\s*=\s*\S{8,}/i,
    severity: "high",
    category: "credentials",
    description: "API key assignment in environment variable format",
    searchQuery: "API_KEY= OR APIKEY= OR ACCESS_KEY=",
  },

  // ── Connection Strings ──────────────────────────────────────
  {
    id: "postgres-uri",
    name: "PostgreSQL Connection String",
    regex: /postgres(?:ql)?:\/\/[^\s'"]{10,}/i,
    severity: "critical",
    category: "connection-strings",
    description: "PostgreSQL database connection URI with credentials",
    searchQuery: "postgres:// OR postgresql://",
  },
  {
    id: "mysql-uri",
    name: "MySQL Connection String",
    regex: /mysql:\/\/[^\s'"]{10,}/i,
    severity: "critical",
    category: "connection-strings",
    description: "MySQL database connection URI with credentials",
    searchQuery: "mysql://",
  },
  {
    id: "mongodb-uri",
    name: "MongoDB Connection String",
    regex: /mongodb(?:\+srv)?:\/\/[^\s'"]{10,}/i,
    severity: "critical",
    category: "connection-strings",
    description: "MongoDB connection URI with credentials",
    searchQuery: "mongodb:// OR mongodb+srv://",
  },
  {
    id: "redis-uri",
    name: "Redis Connection String",
    regex: /redis(?:s)?:\/\/[^\s'"]{10,}/i,
    severity: "high",
    category: "connection-strings",
    description: "Redis connection URI with credentials",
    searchQuery: "redis://",
  },
  {
    id: "jdbc-connection",
    name: "JDBC Connection String",
    regex: /jdbc:[a-z]+:\/\/[^\s'"]{10,}/i,
    severity: "high",
    category: "connection-strings",
    description: "JDBC database connection string",
    searchQuery: "jdbc:",
  },

  // ── PII ─────────────────────────────────────────────────────
  {
    id: "ssn-pattern",
    name: "Social Security Number",
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    severity: "critical",
    category: "pii",
    description: "US Social Security Number pattern (XXX-XX-XXXX)",
    searchQuery: "social security number OR SSN",
  },
  {
    id: "credit-card-visa",
    name: "Credit Card (Visa/MC/Amex)",
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,
    severity: "critical",
    category: "pii",
    description: "Credit card number (Visa, Mastercard, or American Express)",
    searchQuery: "credit card number OR card number",
  },

  // ── Webhooks ────────────────────────────────────────────────
  {
    id: "slack-webhook",
    name: "Slack Webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/,
    severity: "high",
    category: "webhooks",
    description: "Slack incoming webhook URL with workspace and channel tokens",
    searchQuery: "hooks.slack.com/services",
  },
  {
    id: "discord-webhook",
    name: "Discord Webhook URL",
    regex: /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/,
    severity: "high",
    category: "webhooks",
    description: "Discord webhook URL with bot token",
    searchQuery: "discord.com/api/webhooks OR discordapp.com/api/webhooks",
  },
  {
    id: "teams-webhook",
    name: "Microsoft Teams Webhook",
    regex: /https:\/\/[a-z0-9]+\.webhook\.office\.com\/[^\s'"]{20,}/,
    severity: "high",
    category: "webhooks",
    description: "Microsoft Teams incoming webhook connector URL",
    searchQuery: "webhook.office.com",
  },
]

/**
 * Get all patterns for a specific category.
 */
export function getPatternsByCategory(category: SecretCategory): SecretPattern[] {
  return SECRET_PATTERNS.filter((p) => p.category === category)
}

/**
 * Get all patterns for a specific severity.
 */
export function getPatternsBySeverity(severity: SecretSeverity): SecretPattern[] {
  return SECRET_PATTERNS.filter((p) => p.severity === severity)
}

/**
 * Search patterns by name, description, or search query.
 */
export function searchPatterns(term: string): SecretPattern[] {
  const lower = term.toLowerCase()
  return SECRET_PATTERNS.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.searchQuery.toLowerCase().includes(lower)
  )
}

/**
 * Test a snippet against all patterns and return matches.
 */
export function detectSecrets(
  text: string,
  patterns?: SecretPattern[]
): { pattern: SecretPattern; match: string }[] {
  const targets = patterns ?? SECRET_PATTERNS
  const results: { pattern: SecretPattern; match: string }[] = []

  for (const pattern of targets) {
    const m = pattern.regex.exec(text)
    if (m) {
      results.push({ pattern, match: m[0] })
    }
  }

  return results
}
