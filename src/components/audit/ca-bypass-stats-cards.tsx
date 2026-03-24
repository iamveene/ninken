import { Card, CardContent } from "@/components/ui/card"
import type { CaBypassStats } from "@/lib/audit/ca-bypass-scoring"

function StatCard({ value, label, alert }: { value: string | number; label: string; alert?: boolean }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className={`text-2xl font-bold ${alert ? "text-red-400" : "text-foreground"}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

export function CaBypassStatsCards({ stats }: { stats: CaBypassStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard value={`${stats.enforcedPolicies}/${stats.totalPolicies}`} label="Enforced Policies" />
      <StatCard value={stats.legacyAuthBlocked ? "Blocked" : "Open"} label="Legacy Auth" alert={!stats.legacyAuthBlocked} />
      <StatCard value={stats.mfaExclusionCount} label="MFA Exclusions" alert={stats.mfaExclusionCount > 0} />
      <StatCard value={stats.unprotectedAdminRoles} label="Unprotected Admins" alert={stats.unprotectedAdminRoles > 0} />
      <StatCard value={stats.weakSessionPolicies} label="Weak Sessions" alert={stats.weakSessionPolicies > 0} />
    </div>
  )
}
