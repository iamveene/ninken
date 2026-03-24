"use client"

import { Shield, AlertTriangle } from "lucide-react"
import { useGitLabAuditRisk } from "@/hooks/use-gitlab-audit-risk"
import { RiskScoreBadge } from "@/components/audit/risk-score-badge"
import { GitLabRiskStatsCards } from "@/components/audit/gitlab-risk-stats-cards"
import { RiskHeatmap } from "@/components/audit/risk-heatmap"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function GitLabRiskDashboardPage() {
  const { assessment, loading, error } = useGitLabAuditRisk(true)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Risk Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Automated risk assessment across GitLab projects, CI/CD, runners, and access controls.
        </p>
      </div>

      {loading ? (
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
      ) : error && !assessment ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">Unable to compute risk assessment</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : assessment ? (
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
      ) : null}
    </div>
  )
}
