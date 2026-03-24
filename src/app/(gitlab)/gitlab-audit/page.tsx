"use client"

import { useState } from "react"
import { useGitLabUser } from "@/hooks/use-gitlab"
import { useGitLabAuditRisk } from "@/hooks/use-gitlab-audit-risk"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { ServiceError } from "@/components/ui/service-error"
import { RiskScoreBadge } from "@/components/audit/risk-score-badge"
import { GitLabRiskStatsCards } from "@/components/audit/gitlab-risk-stats-cards"
import { RiskHeatmap } from "@/components/audit/risk-heatmap"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import Link from "next/link"
import { Gitlab, Shield, AlertTriangle } from "lucide-react"
import "@/lib/providers"

function RiskAssessmentTab() {
  const { assessment, loading, error } = useGitLabAuditRisk(true)

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error && !assessment) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium">Unable to compute risk assessment</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assessment) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Overall Score */}
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Overall Risk
        </h2>
        <RiskScoreBadge
          severity={assessment.severity}
          score={assessment.aggregateScore}
        />
      </div>

      {/* Stats Cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Key Metrics
        </h2>
        <GitLabRiskStatsCards stats={assessment.stats} />
      </div>

      {/* Risk Heatmap */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Risk Categories
        </h2>
        <RiskHeatmap categories={assessment.categories} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Some data sources failed to load. Risk assessment may be partial.</span>
        </div>
      )}
    </div>
  )
}

export default function GitLabAuditDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
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

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as string)}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="pt-4">
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
        </TabsContent>

        <TabsContent value="risk">
          <div className="pt-4">
            {activeTab === "risk" && <RiskAssessmentTab />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
