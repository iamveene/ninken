"use client"

import Link from "next/link"
import { useAwsIdentity, useAwsIamUsers, useAwsIamRoles, useAwsIamPolicies, useAwsS3Buckets, useAwsSecrets } from "@/hooks/use-aws"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ServiceError } from "@/components/ui/service-error"
import {
  Shield,
  Globe,
  Key,
  TrendingUp,
  Share2,
  AlertTriangle,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react"

const auditCards = [
  {
    id: "iam-policies",
    title: "IAM Policies",
    description: "Wildcard and overly permissive policy detection",
    href: "/aws-audit/iam-policies",
    icon: Shield,
    color: "text-blue-400",
  },
  {
    id: "public-s3",
    title: "Public S3 Buckets",
    description: "Buckets with public access policies",
    href: "/aws-audit/public-s3",
    icon: Globe,
    color: "text-amber-400",
  },
  {
    id: "access-keys",
    title: "Access Keys",
    description: "Stale and unused access key detection",
    href: "/aws-audit/access-keys",
    icon: Key,
    color: "text-emerald-400",
  },
  {
    id: "privesc",
    title: "Privilege Escalation",
    description: "IAM privilege escalation path analysis",
    href: "/aws-audit/privesc",
    icon: TrendingUp,
    color: "text-red-400",
  },
  {
    id: "cross-acct",
    title: "Cross-Account",
    description: "Cross-account role trust analysis",
    href: "/aws-audit/cross-acct",
    icon: Share2,
    color: "text-purple-400",
  },
  {
    id: "secrets",
    title: "Secrets Audit",
    description: "Secret rotation age and hygiene",
    href: "/aws-audit/secrets",
    icon: AlertTriangle,
    color: "text-orange-400",
  },
]

export default function AwsAuditDashboardPage() {
  const { identity, error: identityError } = useAwsIdentity()
  const { users } = useAwsIamUsers()
  const { roles } = useAwsIamRoles()
  const { policies } = useAwsIamPolicies()
  const { buckets } = useAwsS3Buckets()
  const { secrets } = useAwsSecrets()

  if (identityError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">AWS Audit</h1>
        <ServiceError error={identityError} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AWS Audit Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Security posture analysis for {identity?.accountId ?? "..."}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-[10px] text-muted-foreground">IAM Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{roles.length}</p>
            <p className="text-[10px] text-muted-foreground">IAM Roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{policies.length}</p>
            <p className="text-[10px] text-muted-foreground">Policies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{buckets.length}</p>
            <p className="text-[10px] text-muted-foreground">S3 Buckets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{secrets.length}</p>
            <p className="text-[10px] text-muted-foreground">Secrets</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {auditCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.id} href={card.href}>
              <Card className="transition-all hover:border-primary/30 hover:shadow-md cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${card.color}`} />
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-[10px] text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
