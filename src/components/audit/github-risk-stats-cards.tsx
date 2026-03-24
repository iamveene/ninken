import { Card, CardContent } from "@/components/ui/card"
import type { GitHubRiskStats } from "@/lib/audit/github-risk-scoring"

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

export function GitHubRiskStatsCards({ stats }: { stats: GitHubRiskStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard value={stats.totalRepos} label="Total Repos" />
      <StatCard value={stats.unprotectedRepos} label="Unprotected Repos" />
      <StatCard value={stats.selfHostedRunners} label="Self-Hosted Runners" />
      <StatCard value={stats.writeDeployKeys} label="Write Deploy Keys" />
      <StatCard value={stats.insecureWebhooks} label="Insecure Webhooks" />
    </div>
  )
}
