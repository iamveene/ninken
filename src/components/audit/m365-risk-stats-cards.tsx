import { Card, CardContent } from "@/components/ui/card"
import type { M365RiskStats } from "@/lib/audit/m365-risk-scoring"

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

export function M365RiskStatsCards({ stats }: { stats: M365RiskStats }) {
  const weakMfaPct =
    stats.activeUsers > 0
      ? Math.round((stats.usersWithWeakMFA / stats.activeUsers) * 100)
      : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard value={stats.totalUsers} label="Total Users" />
      <StatCard value={`${weakMfaPct}%`} label="Weak MFA" />
      <StatCard value={stats.globalAdminCount} label="Global Admins" />
      <StatCard value={`${stats.enabledCAPolicies}/${stats.totalCAPolicies}`} label="CA Policies" />
      <StatCard value={stats.riskyUserCount} label="Risky Users" />
    </div>
  )
}
