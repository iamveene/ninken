/**
 * AWS Audit Analysis Library
 *
 * Privilege escalation detection and security analysis logic
 * for the Ninken AWS audit mode.
 */

export type PrivEscFinding = {
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  principal: string
  principalType: "user" | "role"
  technique: string
  affectedActions: string[]
}

type IamUserInfo = {
  userName: string
  arn: string
  accessKeys: { accessKeyId: string; status: string; createDate: string }[]
}

type IamRoleInfo = {
  roleName: string
  arn: string
  assumeRolePolicyDocument: string | null
}

type IamPolicyInfo = {
  policyName: string
  arn: string
  attachmentCount: number
}

// Known privilege escalation techniques in AWS
const PRIVESC_TECHNIQUES: {
  technique: string
  severity: "critical" | "high" | "medium"
  description: string
  dangerousActions: string[]
}[] = [
  {
    technique: "iam:CreatePolicyVersion",
    severity: "critical",
    description: "Can create new versions of managed policies, potentially granting full admin access",
    dangerousActions: ["iam:CreatePolicyVersion"],
  },
  {
    technique: "iam:SetDefaultPolicyVersion",
    severity: "critical",
    description: "Can change the default version of a managed policy to one with more permissions",
    dangerousActions: ["iam:SetDefaultPolicyVersion"],
  },
  {
    technique: "iam:CreateAccessKey",
    severity: "high",
    description: "Can create access keys for other IAM users, potentially escalating to their privileges",
    dangerousActions: ["iam:CreateAccessKey"],
  },
  {
    technique: "iam:CreateLoginProfile",
    severity: "high",
    description: "Can create console login profiles for other users",
    dangerousActions: ["iam:CreateLoginProfile"],
  },
  {
    technique: "iam:UpdateLoginProfile",
    severity: "high",
    description: "Can change passwords for other IAM users",
    dangerousActions: ["iam:UpdateLoginProfile"],
  },
  {
    technique: "iam:AttachUserPolicy",
    severity: "critical",
    description: "Can attach managed policies to users, including AdministratorAccess",
    dangerousActions: ["iam:AttachUserPolicy"],
  },
  {
    technique: "iam:AttachGroupPolicy",
    severity: "critical",
    description: "Can attach managed policies to groups",
    dangerousActions: ["iam:AttachGroupPolicy"],
  },
  {
    technique: "iam:AttachRolePolicy",
    severity: "critical",
    description: "Can attach managed policies to roles",
    dangerousActions: ["iam:AttachRolePolicy"],
  },
  {
    technique: "iam:PutUserPolicy",
    severity: "critical",
    description: "Can create inline policies for users",
    dangerousActions: ["iam:PutUserPolicy"],
  },
  {
    technique: "iam:PutGroupPolicy",
    severity: "critical",
    description: "Can create inline policies for groups",
    dangerousActions: ["iam:PutGroupPolicy"],
  },
  {
    technique: "iam:PutRolePolicy",
    severity: "critical",
    description: "Can create inline policies for roles",
    dangerousActions: ["iam:PutRolePolicy"],
  },
  {
    technique: "iam:AddUserToGroup",
    severity: "high",
    description: "Can add users to groups, potentially gaining the group's permissions",
    dangerousActions: ["iam:AddUserToGroup"],
  },
  {
    technique: "iam:UpdateAssumeRolePolicy",
    severity: "high",
    description: "Can modify role trust policies to allow self or others to assume roles",
    dangerousActions: ["iam:UpdateAssumeRolePolicy"],
  },
  {
    technique: "sts:AssumeRole",
    severity: "medium",
    description: "Can assume IAM roles, potentially accessing higher-privileged roles",
    dangerousActions: ["sts:AssumeRole"],
  },
  {
    technique: "lambda:CreateFunction + iam:PassRole",
    severity: "critical",
    description: "Can create Lambda functions with arbitrary execution roles",
    dangerousActions: ["lambda:CreateFunction", "iam:PassRole"],
  },
  {
    technique: "lambda:UpdateFunctionCode",
    severity: "high",
    description: "Can modify existing Lambda function code to execute arbitrary actions with the function's role",
    dangerousActions: ["lambda:UpdateFunctionCode"],
  },
  {
    technique: "ec2:RunInstances + iam:PassRole",
    severity: "high",
    description: "Can launch EC2 instances with arbitrary instance profiles",
    dangerousActions: ["ec2:RunInstances", "iam:PassRole"],
  },
  {
    technique: "iam:PassRole + cloudformation:CreateStack",
    severity: "critical",
    description: "Can create CloudFormation stacks with arbitrary service roles",
    dangerousActions: ["iam:PassRole", "cloudformation:CreateStack"],
  },
]

/**
 * Analyze IAM configuration for privilege escalation paths.
 * This is a static analysis based on known techniques — it doesn't
 * evaluate actual policy documents (that requires GetPolicyVersion calls).
 */
export function analyzePrivEsc(
  users: IamUserInfo[],
  roles: IamRoleInfo[],
  _policies: IamPolicyInfo[],
): PrivEscFinding[] {
  const findings: PrivEscFinding[] = []

  // Flag any user with multiple active access keys (credential management issue)
  for (const user of users) {
    const activeKeys = user.accessKeys.filter((k) => k.status === "Active")
    if (activeKeys.length > 1) {
      findings.push({
        severity: "medium",
        title: `User "${user.userName}" has ${activeKeys.length} active access keys`,
        description: "Multiple active access keys increase the attack surface. Best practice is one key per user.",
        principal: user.userName,
        principalType: "user",
        technique: "credential-management",
        affectedActions: [],
      })
    }
  }

  // Flag roles with overly permissive trust policies
  for (const role of roles) {
    if (!role.assumeRolePolicyDocument) continue
    try {
      const trustPolicy = JSON.parse(role.assumeRolePolicyDocument)
      const statements = trustPolicy.Statement ?? []
      for (const stmt of statements) {
        if (stmt.Effect !== "Allow") continue
        const principal = stmt.Principal
        if (!principal) continue

        // Check for wildcard principal
        if (principal === "*" || principal.AWS === "*") {
          findings.push({
            severity: "critical",
            title: `Role "${role.roleName}" trusts all AWS principals`,
            description: "This role can be assumed by any AWS account. An attacker from any account could escalate privileges by assuming this role.",
            principal: role.roleName,
            principalType: "role",
            technique: "sts:AssumeRole (wildcard trust)",
            affectedActions: ["sts:AssumeRole"],
          })
        }

        // Check for cross-account trust
        const awsPrincipals: string[] = Array.isArray(principal.AWS)
          ? principal.AWS
          : principal.AWS
            ? [principal.AWS]
            : []

        for (const arn of awsPrincipals) {
          if (typeof arn !== "string") continue
          const arnMatch = arn.match(/^arn:aws:iam::(\d{12}):/)
          if (arnMatch) {
            // This is a cross-account trust — flag it for awareness
            findings.push({
              severity: "medium",
              title: `Role "${role.roleName}" trusts external account ${arnMatch[1]}`,
              description: `This role allows assume-role from account ${arnMatch[1]}. Verify this is intentional.`,
              principal: role.roleName,
              principalType: "role",
              technique: "sts:AssumeRole (cross-account)",
              affectedActions: ["sts:AssumeRole"],
            })
          }
        }
      }
    } catch {
      // Malformed trust policy — skip
    }
  }

  // Include the known privesc technique catalog as informational
  for (const technique of PRIVESC_TECHNIQUES) {
    findings.push({
      severity: technique.severity,
      title: technique.technique,
      description: technique.description,
      principal: "Any principal with these permissions",
      principalType: "user",
      technique: technique.technique,
      affectedActions: technique.dangerousActions,
    })
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return findings
}

/**
 * Check if an S3 bucket policy allows public access.
 */
export function isPublicBucketPolicy(policy: Record<string, unknown> | null): boolean {
  if (!policy) return false

  const statements = (policy.Statement ?? []) as Record<string, unknown>[]
  for (const stmt of statements) {
    if (stmt.Effect !== "Allow") continue
    const principal = stmt.Principal
    if (principal === "*") return true
    if (typeof principal === "object" && principal !== null) {
      const p = principal as Record<string, unknown>
      if (p.AWS === "*" || (Array.isArray(p.AWS) && p.AWS.includes("*"))) return true
    }
  }

  return false
}

/**
 * Calculate the age of an access key in days.
 */
export function accessKeyAgeDays(createDate: string): number {
  const created = new Date(createDate)
  const now = new Date()
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

// ── CloudTrail Gap Analysis ──────────────────────────────────────────

export type CloudTrailGap = {
  region: string
  hasTrail: boolean
  trailName?: string
  isMultiRegion: boolean
}

/** Standard AWS regions for CloudTrail coverage analysis */
const COMMON_AWS_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "eu-north-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ap-south-1",
  "sa-east-1",
]

/**
 * Analyze CloudTrail coverage across AWS regions.
 * Compares configured trails against all common regions, flagging gaps.
 */
export function analyzeCloudTrailGaps(
  trails: { name: string; homeRegion: string | null; isMultiRegionTrail: boolean }[],
  allRegions?: string[],
): CloudTrailGap[] {
  const regions = allRegions ?? COMMON_AWS_REGIONS
  const multiRegionTrail = trails.find((t) => t.isMultiRegionTrail)

  return regions.map((region) => {
    if (multiRegionTrail) {
      return {
        region,
        hasTrail: true,
        trailName: multiRegionTrail.name,
        isMultiRegion: true,
      }
    }

    const regionTrail = trails.find((t) => t.homeRegion === region)
    return {
      region,
      hasTrail: !!regionTrail,
      trailName: regionTrail?.name,
      isMultiRegion: false,
    }
  })
}

// ── Security Group Analysis ──────────────────────────────────────────

export type SecurityGroupFinding = {
  groupId: string
  groupName: string
  vpcId: string
  port: number | string
  protocol: string
  sourceRange: string
  riskLevel: "critical" | "high" | "medium"
}

/** Sensitive ports — SSH, RDP are critical; DB ports are high */
const CRITICAL_SG_PORTS = new Set([22, 3389])
const HIGH_SG_PORTS = new Set([3306, 5432, 1433, 6379, 27017, 9200])

/**
 * Analyze security groups for inbound rules open to the world (0.0.0.0/0).
 * Critical: SSH (22), RDP (3389) open to world.
 * High: DB ports open to world.
 * Medium: other ports open to world.
 */
export function analyzeSecurityGroups(
  groups: {
    groupId: string
    groupName: string
    vpcId: string | null
    inboundRules: { protocol: string; fromPort: number | null; toPort: number | null; source: string }[]
  }[],
): SecurityGroupFinding[] {
  const findings: SecurityGroupFinding[] = []

  for (const sg of groups) {
    for (const rule of sg.inboundRules) {
      if (rule.source !== "0.0.0.0/0" && rule.source !== "::/0") continue

      const from = rule.fromPort ?? 0
      const to = rule.toPort ?? 65535
      const protocol = rule.protocol

      // All traffic
      if (protocol === "-1" || (from === 0 && to === 65535)) {
        findings.push({
          groupId: sg.groupId,
          groupName: sg.groupName,
          vpcId: sg.vpcId ?? "",
          port: "all",
          protocol: protocol === "-1" ? "all" : protocol,
          sourceRange: rule.source,
          riskLevel: "critical",
        })
        continue
      }

      // Check individual ports in range
      for (let port = from; port <= to; port++) {
        if (CRITICAL_SG_PORTS.has(port)) {
          findings.push({
            groupId: sg.groupId,
            groupName: sg.groupName,
            vpcId: sg.vpcId ?? "",
            port,
            protocol,
            sourceRange: rule.source,
            riskLevel: "critical",
          })
        } else if (HIGH_SG_PORTS.has(port)) {
          findings.push({
            groupId: sg.groupId,
            groupName: sg.groupName,
            vpcId: sg.vpcId ?? "",
            port,
            protocol,
            sourceRange: rule.source,
            riskLevel: "high",
          })
        }
      }

      // If no specific sensitive port was found, still flag the rule as medium
      const hasSensitive = Array.from({ length: to - from + 1 }, (_, i) => from + i).some(
        (p) => CRITICAL_SG_PORTS.has(p) || HIGH_SG_PORTS.has(p),
      )
      if (!hasSensitive) {
        findings.push({
          groupId: sg.groupId,
          groupName: sg.groupName,
          vpcId: sg.vpcId ?? "",
          port: from === to ? from : `${from}-${to}`,
          protocol,
          sourceRange: rule.source,
          riskLevel: "medium",
        })
      }
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2 }
  findings.sort((a, b) => severityOrder[a.riskLevel] - severityOrder[b.riskLevel])

  return findings
}

// ── Secrets Rotation Analysis ────────────────────────────────────────

export type SecretsRotationFinding = {
  secretName: string
  arn: string
  lastRotated: string | null
  rotationEnabled: boolean
  daysSinceRotation: number
  riskLevel: "critical" | "high" | "medium" | "low"
}

/**
 * Analyze secrets for rotation compliance.
 * >365 days = critical, >180 = high, >90 = medium, else low.
 */
export function analyzeSecretsRotation(
  secrets: {
    name: string
    arn: string
    lastChangedDate: string | null
    lastRotatedDate: string | null
    rotationEnabled: boolean
  }[],
): SecretsRotationFinding[] {
  const now = new Date()

  return secrets.map((secret) => {
    const lastDate = secret.lastRotatedDate ?? secret.lastChangedDate
    let daysSinceRotation = 0

    if (lastDate) {
      const then = new Date(lastDate)
      daysSinceRotation = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
    } else {
      // No date available — assume worst case
      daysSinceRotation = 999
    }

    let riskLevel: "critical" | "high" | "medium" | "low"
    if (daysSinceRotation > 365) riskLevel = "critical"
    else if (daysSinceRotation > 180) riskLevel = "high"
    else if (daysSinceRotation > 90) riskLevel = "medium"
    else riskLevel = "low"

    return {
      secretName: secret.name,
      arn: secret.arn,
      lastRotated: lastDate,
      rotationEnabled: secret.rotationEnabled,
      daysSinceRotation,
      riskLevel,
    }
  })
}
