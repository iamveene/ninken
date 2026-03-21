import { Card, CardContent } from "@/components/ui/card"
import type { RiskStats } from "@/lib/audit/risk-scoring"

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

export function RiskStatsCards({ stats }: { stats: RiskStats }) {
  const twofaPct =
    stats.activeUsers > 0
      ? Math.round(((stats.activeUsers - stats.usersWithout2FA) / stats.activeUsers) * 100)
      : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard value={stats.totalUsers} label="Total Users" />
      <StatCard value={`${twofaPct}%`} label="2FA Coverage" />
      <StatCard value={stats.superAdminCount} label="Super Admins" />
      <StatCard value={stats.totalGroups} label="Groups" />
      <StatCard value={stats.delegationCount} label="Delegations" />
    </div>
  )
}
