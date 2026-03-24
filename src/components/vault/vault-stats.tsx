"use client"

import {
  KeyRound,
  Shield,
  Globe,
  RefreshCw,
} from "lucide-react"
import type { VaultStats as Stats } from "@/lib/vault/types"

const SECRET_TYPES = new Set(["aws", "gcp", "github", "microsoft", "slack", "gitlab", "generic"])

function getCategoryBreakdown(byType: Record<string, number>) {
  let secrets = 0
  let pii = 0
  let urls = 0
  let infra = 0
  for (const [type, count] of Object.entries(byType)) {
    if (SECRET_TYPES.has(type)) secrets += count
    else if (type === "pii") pii += count
    else if (type === "url") urls += count
    else if (type === "infrastructure") infra += count
  }
  return { secrets, pii, urls, infra }
}

type VaultStatsProps = {
  stats: Stats
}

export function VaultStats({ stats }: VaultStatsProps) {
  const topType = Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0]
  const topProvider = Object.entries(stats.byProvider).sort((a, b) => b[1] - a[1])[0]
  const breakdown = getCategoryBreakdown(stats.byType)

  const breakdownParts: string[] = []
  if (breakdown.secrets > 0) breakdownParts.push(`${breakdown.secrets} Secrets`)
  if (breakdown.pii > 0) breakdownParts.push(`${breakdown.pii} PII`)
  if (breakdown.urls > 0) breakdownParts.push(`${breakdown.urls} URLs`)
  if (breakdown.infra > 0) breakdownParts.push(`${breakdown.infra} Infra`)

  const statCards = [
    {
      label: "Total Items",
      value: stats.total,
      subtitle: breakdownParts.length > 0 ? breakdownParts.join(" / ") : undefined,
      icon: KeyRound,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Top Type",
      value: topType ? `${topType[0]} (${topType[1]})` : "-",
      subtitle: undefined as string | undefined,
      icon: Shield,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
    {
      label: "Top Provider",
      value: topProvider ? `${topProvider[0]} (${topProvider[1]})` : "-",
      subtitle: undefined as string | undefined,
      icon: Globe,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
    },
    {
      label: "Reinjected",
      value: stats.reinjected,
      subtitle: undefined as string | undefined,
      icon: RefreshCw,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border bg-card p-3"
          >
            <div
              className={`flex size-10 items-center justify-center rounded-lg ${card.bg}`}
            >
              <Icon className={`size-5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-lg font-semibold tabular-nums truncate">{card.value}</p>
              {card.subtitle && (
                <p className="text-[10px] text-muted-foreground/70 truncate">{card.subtitle}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
