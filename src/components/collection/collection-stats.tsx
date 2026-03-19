"use client"

import {
  PackagePlus,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from "lucide-react"
import type { CollectionStats as Stats } from "@/lib/collection-store"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

type CollectionStatsProps = {
  stats: Stats
}

export function CollectionStats({ stats }: CollectionStatsProps) {
  const statCards = [
    {
      label: "Total",
      value: stats.total,
      icon: PackagePlus,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Downloading",
      value: stats.downloading,
      icon: Download,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
    {
      label: "Completed",
      value: stats.done,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
    },
    {
      label: "Errors",
      value: stats.error,
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
    },
    {
      label: "Size",
      value: formatBytes(stats.totalBytes),
      icon: HardDrive,
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-gray-950/40",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-lg font-semibold tabular-nums">{card.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
