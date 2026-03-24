import type {
  AwsCredential,
  BaseCredential,
  ServiceProvider,
} from "./types"
import { awsIdentity, parseAwsError } from "@/lib/aws"

// ── Detection helpers ─────────────────────────────────────────────────

function isAwsKeyId(s: string): boolean {
  return /^(AKIA|ASIA)[A-Z0-9]{16}$/.test(s.trim())
}

function isAwsString(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  return isAwsKeyId(raw.trim())
}

function isAwsObject(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false
  const obj = raw as Record<string, unknown>

  // Explicit provider tag
  if (obj.provider === "aws") return true

  // Ninken format: { access_key_id, secret_access_key }
  if (typeof obj.access_key_id === "string" && typeof obj.secret_access_key === "string") {
    return isAwsKeyId(obj.access_key_id)
  }

  // AWS CLI / boto format: { aws_access_key_id, aws_secret_access_key }
  if (typeof obj.aws_access_key_id === "string" && typeof obj.aws_secret_access_key === "string") {
    return isAwsKeyId(obj.aws_access_key_id)
  }

  // camelCase format from some tools: { accessKeyId, secretAccessKey }
  if (typeof obj.accessKeyId === "string" && typeof obj.secretAccessKey === "string") {
    return isAwsKeyId(obj.accessKeyId)
  }

  return false
}

// ── Provider ──────────────────────────────────────────────────────────

export const awsProvider: ServiceProvider = {
  id: "aws",
  name: "AWS",
  description: "S3, IAM, Lambda, EC2, CloudTrail, Secrets",
  iconName: "Cloud",

  detectCredential(raw: unknown): boolean {
    if (isAwsString(raw)) return true
    return isAwsObject(raw)
  },

  validateCredential(
    raw: unknown,
  ):
    | { valid: true; credential: BaseCredential; email?: string }
    | { valid: false; error: string } {

    let accessKeyId: string | undefined
    let secretAccessKey: string | undefined
    let sessionToken: string | undefined
    let defaultRegion: string | undefined

    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>

      // Ninken snake_case format
      if (typeof obj.access_key_id === "string") {
        accessKeyId = obj.access_key_id
        secretAccessKey = obj.secret_access_key as string | undefined
        sessionToken = obj.session_token as string | undefined
        defaultRegion = obj.default_region as string | undefined
      }
      // AWS CLI format (aws_access_key_id / aws_secret_access_key)
      else if (typeof obj.aws_access_key_id === "string") {
        accessKeyId = obj.aws_access_key_id
        secretAccessKey = obj.aws_secret_access_key as string | undefined
        sessionToken = obj.aws_session_token as string | undefined
        defaultRegion = (obj.region ?? obj.aws_default_region) as string | undefined
      }
      // camelCase format (accessKeyId / secretAccessKey)
      else if (typeof obj.accessKeyId === "string") {
        accessKeyId = obj.accessKeyId
        secretAccessKey = obj.secretAccessKey as string | undefined
        sessionToken = obj.sessionToken as string | undefined
        defaultRegion = obj.region as string | undefined
      }
    }

    if (!accessKeyId || !isAwsKeyId(accessKeyId)) {
      return {
        valid: false,
        error: "Missing or invalid AWS Access Key ID (expected AKIA* or ASIA*)",
      }
    }

    if (!secretAccessKey) {
      return {
        valid: false,
        error: "Missing AWS Secret Access Key",
      }
    }

    if (secretAccessKey.trim().length < 40) {
      return {
        valid: false,
        error: "Invalid AWS Secret Access Key (expected at least 40 characters)",
      }
    }

    const credential: AwsCredential = {
      provider: "aws",
      credentialKind: "access-token",
      access_key_id: accessKeyId.trim(),
      secret_access_key: secretAccessKey.trim(),
      session_token: sessionToken?.trim() || undefined,
      default_region: defaultRegion?.trim() || undefined,
    }

    return { valid: true, credential }
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    // AWS doesn't use a single bearer token — return the access key ID
    // as a nominal identifier for the credential.
    return (credential as AwsCredential).access_key_id
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    // AWS doesn't have OAuth scopes. Call STS to return the ARN as a synthetic scope.
    try {
      const identity = await awsIdentity(credential as AwsCredential)
      return [identity.arn]
    } catch {
      return []
    }
  },

  emailEndpoint: "/api/aws/me",
  defaultRoute: "/aws-dashboard",

  operateNavItems: [
    { id: "aws-dashboard", title: "Dashboard", href: "/aws-dashboard", iconName: "LayoutDashboard" },
    { id: "aws-s3", title: "S3", href: "/aws-s3", iconName: "Database" },
    { id: "aws-iam", title: "IAM", href: "/aws-iam", iconName: "Shield" },
    { id: "aws-lambda", title: "Lambda", href: "/aws-lambda", iconName: "Zap" },
    { id: "aws-ec2", title: "EC2", href: "/aws-ec2", iconName: "Server" },
    { id: "aws-cloudtrail", title: "CloudTrail", href: "/aws-cloudtrail", iconName: "Activity" },
    { id: "aws-secrets", title: "Secrets", href: "/aws-secrets", iconName: "KeyRound" },
  ],

  auditNavItems: [
    { id: "aws-audit-dashboard", title: "Dashboard", href: "/aws-audit", iconName: "LayoutDashboard" },
    { id: "aws-audit-iam-policies", title: "IAM Policies", href: "/aws-audit/iam-policies", iconName: "Shield" },
    { id: "aws-audit-public-s3", title: "Public S3", href: "/aws-audit/public-s3", iconName: "Globe" },
    { id: "aws-audit-access-keys", title: "Access Keys", href: "/aws-audit/access-keys", iconName: "Key" },
    { id: "aws-audit-privesc", title: "Privilege Escalation", href: "/aws-audit/privesc", iconName: "TrendingUp" },
    { id: "aws-audit-cross-acct", title: "Cross-Account", href: "/aws-audit/cross-acct", iconName: "Share2" },
    { id: "aws-audit-secrets", title: "Secrets", href: "/aws-audit/secrets", iconName: "AlertTriangle" },
    { id: "aws-cloudtrail-gaps", title: "CloudTrail Gaps", href: "/aws-audit/cloudtrail-gaps", iconName: "MapPin" },
    { id: "aws-security-groups", title: "Security Groups", href: "/aws-audit/security-groups", iconName: "Network" },
    { id: "aws-secrets-rotation", title: "Secrets Rotation", href: "/aws-audit/secrets-rotation", iconName: "RefreshCw" },
    { id: "aws-lambda-urls", title: "Lambda URLs", href: "/aws-audit/lambda-urls", iconName: "ExternalLink" },
  ],

  exploreNavGroups: [
    {
      label: "Audit",
      items: [
        { id: "aws-audit-dashboard", title: "Dashboard", href: "/aws-audit", iconName: "LayoutDashboard" },
        { id: "aws-audit-iam-policies", title: "IAM Policies", href: "/aws-audit/iam-policies", iconName: "Shield" },
        { id: "aws-audit-public-s3", title: "Public S3", href: "/aws-audit/public-s3", iconName: "Globe" },
        { id: "aws-audit-access-keys", title: "Access Keys", href: "/aws-audit/access-keys", iconName: "Key" },
        { id: "aws-audit-privesc", title: "Privilege Escalation", href: "/aws-audit/privesc", iconName: "TrendingUp" },
        { id: "aws-audit-cross-acct", title: "Cross-Account", href: "/aws-audit/cross-acct", iconName: "Share2" },
        { id: "aws-audit-secrets", title: "Secrets", href: "/aws-audit/secrets", iconName: "AlertTriangle" },
        { id: "aws-cloudtrail-gaps", title: "CloudTrail Gaps", href: "/aws-audit/cloudtrail-gaps", iconName: "MapPin" },
        { id: "aws-security-groups", title: "Security Groups", href: "/aws-audit/security-groups", iconName: "Network" },
        { id: "aws-secrets-rotation", title: "Secrets Rotation", href: "/aws-audit/secrets-rotation", iconName: "RefreshCw" },
        { id: "aws-lambda-urls", title: "Lambda URLs", href: "/aws-audit/lambda-urls", iconName: "ExternalLink" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { id: "explore-graphs", title: "Adversarial Graphs", href: "/explore/graphs", iconName: "Share2" },
      ],
    },
  ],

  scopeAppMap: {
    "aws-s3": ["s3:ListBuckets", "s3:GetObject"],
    "aws-iam": ["iam:ListUsers", "iam:ListRoles"],
    "aws-lambda": ["lambda:ListFunctions"],
    "aws-ec2": ["ec2:DescribeInstances"],
    "aws-cloudtrail": ["cloudtrail:LookupEvents"],
    "aws-secrets": ["secretsmanager:ListSecrets"],
  },

  parseApiError(error: unknown): { status: number; message: string } | null {
    if (!error || typeof error !== "object") return null
    const err = error as { $metadata?: { httpStatusCode?: number }; name?: string; message?: string }
    if (err.$metadata?.httpStatusCode || err.name) {
      return parseAwsError(error)
    }
    return null
  },

  canRefresh(): boolean {
    return false
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    const c = credential as AwsCredential
    return {
      provider: "aws",
      credentialKind: "access-token",
      access_key_id: c.access_key_id,
      secret_access_key: c.secret_access_key,
      session_token: c.session_token,
      default_region: c.default_region,
    } as AwsCredential
  },
}
