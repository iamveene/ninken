"use client"

import { formatDistanceToNow } from "date-fns"
import { ExternalLink, Mail, HardDrive, Calendar, Database, Cloud } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { QueryResultItem, ServiceId } from "@/lib/audit/query-types"

const SERVICE_ICONS: Record<ServiceId, typeof Mail> = {
  gmail: Mail,
  drive: HardDrive,
  calendar: Calendar,
  buckets: Database,
  outlook: Mail,
  onedrive: Cloud,
}

const SERVICE_COLORS: Record<ServiceId, string> = {
  gmail: "text-red-400",
  drive: "text-blue-400",
  calendar: "text-green-400",
  buckets: "text-amber-400",
  outlook: "text-blue-400",
  onedrive: "text-sky-400",
}

type ResultItemProps = {
  item: QueryResultItem
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ""
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return ""
  }
}

export function ResultItem({ item }: ResultItemProps) {
  const Icon = SERVICE_ICONS[item.service] ?? HardDrive
  const color = SERVICE_COLORS[item.service] ?? "text-muted-foreground"
  const dateStr = formatDate(item.date)
  const isAdvisory = item.metadata.advisory === true

  return (
    <div
      className={`group flex gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border hover:bg-muted/30 ${
        isAdvisory ? "opacity-70 border-dashed" : ""
      }`}
    >
      <div className={`shrink-0 mt-0.5 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start gap-2">
          <h4 className="text-sm font-medium truncate flex-1">{item.title}</h4>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {item.snippet && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.snippet}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={`text-[10px] ${color} bg-transparent border-current/20`}>
            {item.service}
          </Badge>
          {dateStr && (
            <span className="text-[10px] text-muted-foreground">{dateStr}</span>
          )}
          {typeof item.metadata.from === "string" && item.metadata.from && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
              from: {item.metadata.from}
            </span>
          )}
          {item.metadata.shared === true && (
            <Badge variant="secondary" className="text-[10px] text-amber-400 bg-amber-500/10 border-transparent">
              Shared
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
