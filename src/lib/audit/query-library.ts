/**
 * Pre-built red team query library for cross-service intelligence search.
 * 30+ queries organized by category targeting credentials, API keys,
 * infrastructure, PII, internal access patterns, and more.
 */

import type { PrebuiltQuery, QueryCategory } from "./query-types"

export const QUERY_CATEGORIES: Record<QueryCategory, { label: string; description: string }> = {
  credentials: {
    label: "Credentials",
    description: "Passwords, tokens, secrets, and authentication material",
  },
  "api-keys": {
    label: "API Keys",
    description: "API keys, service account keys, and access tokens",
  },
  infrastructure: {
    label: "Infrastructure",
    description: "Server configs, network diagrams, deployment details",
  },
  pii: {
    label: "PII / Sensitive Data",
    description: "Personal information, SSNs, credit cards, health records",
  },
  "internal-access": {
    label: "Internal Access",
    description: "VPN configs, internal URLs, admin panels, jump hosts",
  },
  security: {
    label: "Security",
    description: "Security policies, incident reports, vulnerability findings",
  },
  recon: {
    label: "Reconnaissance",
    description: "Org charts, vendor lists, technology stacks, budgets",
  },
  exfiltration: {
    label: "Exfiltration Indicators",
    description: "Large file shares, external forwarding, data transfers",
  },
}

export const PREBUILT_QUERIES: PrebuiltQuery[] = [
  // ── Credentials ──────────────────────────────────────────────
  {
    id: "cred-password-files",
    name: "Password files",
    description: "Documents containing password lists or credential stores",
    category: "credentials",
    query: "password filename:password OR filename:credentials OR filename:secrets",
    services: ["drive", "onedrive"],
    severity: "critical",
    tags: ["password", "credential-store"],
  },
  {
    id: "cred-password-emails",
    name: "Passwords in email",
    description: "Emails containing password sharing or resets",
    category: "credentials",
    query: "password is:unread OR subject:password OR subject:credentials",
    services: ["gmail", "outlook"],
    severity: "critical",
    tags: ["password", "email"],
  },
  {
    id: "cred-private-keys",
    name: "Private keys",
    description: "SSH keys, PEM files, and private key material",
    category: "credentials",
    query: "BEGIN PRIVATE KEY OR BEGIN RSA PRIVATE KEY OR id_rsa",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["ssh", "private-key", "pem"],
  },
  {
    id: "cred-env-files",
    name: "Environment files (.env)",
    description: "Environment configuration files with secrets",
    category: "credentials",
    query: ".env filename:env OR filename:dotenv OR filename:environment",
    services: ["drive", "onedrive"],
    severity: "critical",
    tags: ["env", "config", "secrets"],
  },
  {
    id: "cred-database-strings",
    name: "Database connection strings",
    description: "Database URLs, connection strings, and credentials",
    category: "credentials",
    query: "mongodb:// OR postgres:// OR mysql:// OR jdbc: OR connection string",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["database", "connection-string"],
  },
  {
    id: "cred-oauth-tokens",
    name: "OAuth tokens",
    description: "OAuth tokens, refresh tokens, and bearer tokens",
    category: "credentials",
    query: "bearer token OR refresh_token OR access_token OR oauth",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["oauth", "token"],
  },

  // ── API Keys ─────────────────────────────────────────────────
  {
    id: "api-aws-keys",
    name: "AWS access keys",
    description: "AWS access key IDs and secret keys",
    category: "api-keys",
    query: "AKIA OR aws_access_key_id OR aws_secret_access_key",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["aws", "cloud"],
  },
  {
    id: "api-gcp-keys",
    name: "GCP service account keys",
    description: "Google Cloud Platform service account key files",
    category: "api-keys",
    query: "service_account OR private_key_id OR client_x509_cert_url",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["gcp", "service-account"],
  },
  {
    id: "api-azure-keys",
    name: "Azure keys & secrets",
    description: "Azure subscription keys, connection strings, SAS tokens",
    category: "api-keys",
    query: "azure OR SharedAccessSignature OR AccountKey= OR subscription key",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["azure", "cloud"],
  },
  {
    id: "api-stripe-keys",
    name: "Stripe API keys",
    description: "Stripe publishable and secret keys",
    category: "api-keys",
    query: "sk_live_ OR sk_test_ OR pk_live_ OR stripe api key",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["stripe", "payment"],
  },
  {
    id: "api-slack-tokens",
    name: "Slack tokens",
    description: "Slack bot tokens, webhook URLs, and API tokens",
    category: "api-keys",
    query: "xoxb- OR xoxp- OR hooks.slack.com/services",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["slack", "webhook"],
  },
  {
    id: "api-github-tokens",
    name: "GitHub tokens",
    description: "GitHub personal access tokens and app tokens",
    category: "api-keys",
    query: "ghp_ OR gho_ OR github_pat_ OR github token",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["github", "token"],
  },
  {
    id: "api-sendgrid-keys",
    name: "SendGrid / Twilio keys",
    description: "SendGrid API keys and Twilio auth tokens",
    category: "api-keys",
    query: "SG. OR sendgrid OR twilio auth token OR TWILIO_AUTH",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["sendgrid", "twilio"],
  },

  // ── Infrastructure ───────────────────────────────────────────
  {
    id: "infra-network-diagrams",
    name: "Network diagrams",
    description: "Network topology, architecture diagrams, and infrastructure docs",
    category: "infrastructure",
    query: "network diagram OR topology OR architecture diagram OR infrastructure",
    services: ["drive", "onedrive"],
    severity: "high",
    tags: ["network", "diagram"],
  },
  {
    id: "infra-terraform",
    name: "Terraform / IaC configs",
    description: "Infrastructure-as-code files with deployment configs",
    category: "infrastructure",
    query: "terraform OR .tf OR ansible OR cloudformation OR pulumi",
    services: ["drive", "onedrive", "gmail", "outlook"],
    severity: "high",
    tags: ["terraform", "iac", "devops"],
  },
  {
    id: "infra-kubernetes",
    name: "Kubernetes configs",
    description: "K8s manifests, helm charts, and cluster configs",
    category: "infrastructure",
    query: "kubeconfig OR kubectl OR kubernetes OR helm chart OR kube-system",
    services: ["drive", "onedrive", "gmail", "outlook"],
    severity: "high",
    tags: ["kubernetes", "k8s"],
  },
  {
    id: "infra-server-configs",
    name: "Server configurations",
    description: "Server config files, nginx, apache, and deployment scripts",
    category: "infrastructure",
    query: "nginx.conf OR httpd.conf OR server config OR deploy script",
    services: ["drive", "onedrive"],
    severity: "medium",
    tags: ["server", "config"],
  },
  {
    id: "infra-ci-cd",
    name: "CI/CD pipelines",
    description: "CI/CD configuration with potential secrets",
    category: "infrastructure",
    query: "github actions OR gitlab-ci OR jenkinsfile OR circleci OR pipeline",
    services: ["drive", "onedrive", "gmail", "outlook"],
    severity: "medium",
    tags: ["cicd", "pipeline"],
  },

  // ── PII / Sensitive Data ─────────────────────────────────────
  {
    id: "pii-ssn",
    name: "Social Security Numbers",
    description: "Documents containing SSN patterns or references",
    category: "pii",
    query: "social security number OR SSN OR SIN number",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["ssn", "pii"],
  },
  {
    id: "pii-credit-cards",
    name: "Credit card numbers",
    description: "Credit card data, PAN, or payment card information",
    category: "pii",
    query: "credit card number OR card number OR expiration date CVV",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["credit-card", "pci"],
  },
  {
    id: "pii-employee-data",
    name: "Employee records",
    description: "HR records, salary info, employee databases",
    category: "pii",
    query: "employee list OR salary OR compensation OR HR records OR payroll",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["hr", "employee", "salary"],
  },
  {
    id: "pii-health-records",
    name: "Health / medical records",
    description: "PHI, medical records, HIPAA-relevant data",
    category: "pii",
    query: "medical record OR patient data OR health record OR diagnosis OR HIPAA",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["health", "phi", "hipaa"],
  },

  // ── Internal Access ──────────────────────────────────────────
  {
    id: "access-vpn",
    name: "VPN configurations",
    description: "VPN config files, credentials, and access instructions",
    category: "internal-access",
    query: "vpn config OR vpn credentials OR openvpn OR wireguard OR .ovpn",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "critical",
    tags: ["vpn", "remote-access"],
  },
  {
    id: "access-admin-panels",
    name: "Admin panel URLs",
    description: "Internal admin interfaces, dashboards, and portals",
    category: "internal-access",
    query: "admin panel OR admin dashboard OR admin portal OR internal tool",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["admin", "internal"],
  },
  {
    id: "access-jump-hosts",
    name: "Jump hosts / bastion",
    description: "Bastion hosts, jump servers, and SSH access instructions",
    category: "internal-access",
    query: "bastion OR jump host OR jump server OR ssh gateway OR ProxyJump",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["bastion", "ssh"],
  },
  {
    id: "access-wifi",
    name: "WiFi credentials",
    description: "Corporate WiFi passwords and network access details",
    category: "internal-access",
    query: "wifi password OR wireless key OR SSID OR network password",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "medium",
    tags: ["wifi", "network"],
  },

  // ── Security ─────────────────────────────────────────────────
  {
    id: "sec-pentest-reports",
    name: "Pentest reports",
    description: "Penetration testing reports and vulnerability assessments",
    category: "security",
    query: "pentest report OR penetration test OR vulnerability assessment OR security audit",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["pentest", "vulnerability"],
  },
  {
    id: "sec-incident-reports",
    name: "Incident reports",
    description: "Security incident reports, breach notifications, and post-mortems",
    category: "security",
    query: "incident report OR breach notification OR security incident OR post-mortem",
    services: ["gmail", "drive", "outlook", "onedrive"],
    severity: "high",
    tags: ["incident", "breach"],
  },
  {
    id: "sec-firewall-rules",
    name: "Firewall rules",
    description: "Firewall configurations, ACLs, and security group rules",
    category: "security",
    query: "firewall rules OR security group OR ACL OR iptables OR network policy",
    services: ["drive", "onedrive", "gmail", "outlook"],
    severity: "medium",
    tags: ["firewall", "network"],
  },

  // ── Reconnaissance ───────────────────────────────────────────
  {
    id: "recon-org-chart",
    name: "Organization charts",
    description: "Org charts, reporting structures, and team hierarchy",
    category: "recon",
    query: "org chart OR organization chart OR reporting structure OR team structure",
    services: ["drive", "onedrive"],
    severity: "low",
    tags: ["orgchart", "recon"],
  },
  {
    id: "recon-vendor-list",
    name: "Vendor & supplier lists",
    description: "Third-party vendor lists, supplier agreements, and contacts",
    category: "recon",
    query: "vendor list OR supplier OR third party OR contractor list",
    services: ["drive", "onedrive", "gmail", "outlook"],
    severity: "low",
    tags: ["vendor", "supply-chain"],
  },
  {
    id: "recon-budget",
    name: "Budget & financial docs",
    description: "Budget spreadsheets, financial plans, and forecasts",
    category: "recon",
    query: "budget OR financial plan OR forecast OR revenue OR quarterly report",
    services: ["drive", "onedrive", "gmail", "outlook"],
    severity: "medium",
    tags: ["finance", "budget"],
  },
  {
    id: "recon-technology-stack",
    name: "Technology stack",
    description: "Tech stack documentation, software inventory, license keys",
    category: "recon",
    query: "tech stack OR software inventory OR license key OR technology list",
    services: ["drive", "onedrive"],
    severity: "low",
    tags: ["techstack", "inventory"],
  },

  // ── Exfiltration Indicators ──────────────────────────────────
  {
    id: "exfil-shared-external",
    name: "Externally shared files",
    description: "Files shared with external users or publicly accessible",
    category: "exfiltration",
    query: "shared externally OR anyone with the link OR public access",
    services: ["drive", "onedrive"],
    severity: "medium",
    tags: ["sharing", "external"],
  },
  {
    id: "exfil-forwarding",
    name: "Email forwarding rules",
    description: "Auto-forwarding rules that may indicate data exfiltration",
    category: "exfiltration",
    query: "forward to OR auto-forward OR forwarding rule OR mail flow rule",
    services: ["gmail", "outlook"],
    severity: "high",
    tags: ["forwarding", "email-rules"],
  },
  {
    id: "exfil-large-attachments",
    name: "Large attachments",
    description: "Emails with large attachments that may indicate bulk data transfer",
    category: "exfiltration",
    query: "has:attachment larger:10M",
    services: ["gmail"],
    severity: "medium",
    tags: ["attachment", "large-file"],
  },
  {
    id: "exfil-calendar-external",
    name: "External calendar invites",
    description: "Calendar events shared with external domains",
    category: "exfiltration",
    query: "external meeting OR external invite",
    services: ["calendar"],
    severity: "info",
    tags: ["calendar", "external"],
  },
]

/**
 * Get all queries for a specific category.
 */
export function getQueriesByCategory(category: QueryCategory): PrebuiltQuery[] {
  return PREBUILT_QUERIES.filter((q) => q.category === category)
}

/**
 * Get all queries that target a specific service.
 */
export function getQueriesForService(service: string): PrebuiltQuery[] {
  return PREBUILT_QUERIES.filter(
    (q) => q.services.length === 0 || q.services.includes(service as PrebuiltQuery["services"][number])
  )
}

/**
 * Get a specific query by ID.
 */
export function getQueryById(id: string): PrebuiltQuery | undefined {
  return PREBUILT_QUERIES.find((q) => q.id === id)
}

/**
 * Search queries by name, description, or tags.
 */
export function searchQueries(term: string): PrebuiltQuery[] {
  const lower = term.toLowerCase()
  return PREBUILT_QUERIES.filter(
    (q) =>
      q.name.toLowerCase().includes(lower) ||
      q.description.toLowerCase().includes(lower) ||
      q.tags.some((t) => t.includes(lower)) ||
      q.query.toLowerCase().includes(lower)
  )
}
