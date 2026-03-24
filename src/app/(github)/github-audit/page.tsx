"use client"

import { useState } from "react"
import { useGitHubUser, useGitHubRepos, useGitHubOrgs } from "@/hooks/use-github"
import { ServiceError } from "@/components/ui/service-error"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Shield,
  BookMarked,
  Building2,
  Activity,
  User,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { useGitHubAuditRisk } from "@/hooks/use-github-audit-risk"
import { RiskScoreBadge } from "@/components/audit/risk-score-badge"
import { GitHubRiskStatsCards } from "@/components/audit/github-risk-stats-cards"
import { RiskHeatmap } from "@/components/audit/risk-heatmap"

function GitHubRiskAssessmentTab() {
  const { assessment, loading, error } = useGitHubAuditRisk(true)

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
        <GitHubRiskStatsCards stats={assessment.stats} />
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

export default function GitHubAuditDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const { user, loading: userLoading, error: userError } = useGitHubUser()
  const { repos, loading: reposLoading } = useGitHubRepos()
  const { orgs, loading: orgsLoading } = useGitHubOrgs()

  if (userError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">GitHub Security Audit</h1>
        <ServiceError error={userError} />
      </div>
    )
  }

  const rateLimitRemaining = user?.rateLimit?.remaining ?? 0
  const rateLimitReset = user?.rateLimit?.reset
    ? new Date(user.rateLimit.reset * 1000).toLocaleTimeString()
    : "N/A"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          GitHub Security Audit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your GitHub security posture
        </p>
      </div>

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
          <div className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <User className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {userLoading ? "-" : user?.login ?? "?"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">User</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <BookMarked className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {reposLoading ? "-" : repos.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Repos</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {orgsLoading ? "-" : orgs.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Orgs</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Activity className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{rateLimitRemaining}</p>
                    <p className="text-[10px] text-muted-foreground">Rate Limit</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Clock className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-lg font-bold">{rateLimitReset}</p>
                    <p className="text-[10px] text-muted-foreground">Reset At</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-3">Token Info</h2>
              <Card>
                <CardContent className="p-4">
                  {userLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
                      ))}
                    </div>
                  ) : user ? (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Token Type</p>
                        <Badge variant="outline" className="text-[10px] font-mono mt-0.5">
                          {user.tokenType}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Account Type</p>
                        <p className="text-xs font-medium">{user.type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">2FA</p>
                        <p className="text-xs font-medium">
                          {user.twoFactorAuthentication === true
                            ? "Enabled"
                            : user.twoFactorAuthentication === false
                              ? "Disabled"
                              : "Unknown"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Scopes</p>
                        <p className="text-xs font-medium">{user.scopes.length} granted</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No user data</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {user && user.scopes.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3">Scopes</h2>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {user.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] font-mono">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="risk">
          <div className="pt-4">
            {activeTab === "risk" && <GitHubRiskAssessmentTab />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
