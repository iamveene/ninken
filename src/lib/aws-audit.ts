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
