"use client"

import { useGitLabUser } from "@/hooks/use-gitlab"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { ServiceError } from "@/components/ui/service-error"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Gitlab, Shield } from "lucide-react"
import "@/lib/providers"

export default function GitLabAuditDashboard() {
  const { user, error: userError } = useGitLabUser()
  const providerConfig = getProvider("gitlab")
  const auditNavItems = providerConfig?.auditNavItems ?? []

  if (userError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">GitLab Audit</h1>
        <ServiceError error={userError} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">GitLab Audit</h1>
          <p className="text-xs text-muted-foreground">
            Security assessment for {user?.username ?? "unknown user"}
          </p>
        </div>
      </div>

      {user?.isAdmin && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Gitlab className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-medium text-amber-400">
                Admin access detected — full enumeration capabilities available
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {auditNavItems.filter(item => item.id !== "gitlab-audit-dashboard").map((item) => {
          const Icon = resolveIcon(item.iconName)
          return (
            <Link key={item.id} href={item.href}>
              <Card className="transition-all hover:border-primary/30 hover:shadow-md cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Badge variant="outline" className="text-[10px]">
                    Enumerate
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
