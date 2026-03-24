import { Card, CardContent } from "@/components/ui/card"
import type { GitLabRiskStats } from "@/lib/audit/gitlab-risk-scoring"

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

export function GitLabRiskStatsCards({ stats }: { stats: GitLabRiskStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard value={stats.totalProjects} label="Total Projects" />
      <StatCard value={stats.unprotectedProjects} label="Unprotected Projects" />
      <StatCard value={stats.unmaskedVariables} label="Unmasked Variables" />
      <StatCard value={stats.nonSharedRunners} label="Non-Shared Runners" />
      <StatCard value={stats.expiredTokens} label="Expired Tokens" />
    </div>
  )
}
