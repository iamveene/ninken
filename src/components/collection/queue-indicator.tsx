"use client"

import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { CollectionStats } from "@/lib/collection-store"

type QueueIndicatorProps = {
  stats: CollectionStats
}

export function QueueIndicator({ stats }: QueueIndicatorProps) {
  if (stats.total === 0) return null

  const active = stats.pending + stats.downloading

  if (active > 0) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="secondary"
            className="gap-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-0"
          >
            <Loader2 className="size-3 animate-spin" />
            {active} in queue
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {stats.downloading > 0 && <p>{stats.downloading} downloading</p>}
          {stats.pending > 0 && <p>{stats.pending} pending</p>}
        </TooltipContent>
      </Tooltip>
    )
  }

  if (stats.error > 0) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="secondary"
            className="gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0"
          >
            <AlertCircle className="size-3" />
            {stats.error} failed
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {stats.error} item{stats.error > 1 ? "s" : ""} failed to download
        </TooltipContent>
      </Tooltip>
    )
  }

  if (stats.done > 0) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="secondary"
            className="gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0"
          >
            <CheckCircle2 className="size-3" />
            {stats.done} collected
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{stats.done} items collected</TooltipContent>
      </Tooltip>
    )
  }

  return null
}
