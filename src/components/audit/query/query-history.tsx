"use client"

import { formatDistanceToNow } from "date-fns"
import { Clock, Trash2, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { QueryHistoryEntry, ServiceId } from "@/lib/audit/query-types"

type QueryHistoryProps = {
  history: QueryHistoryEntry[]
  onReplay: (query: string, services: ServiceId[]) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

export function QueryHistory({
  history,
  onReplay,
  onRemove,
  onClearAll,
}: QueryHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        <Clock className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No query history yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Recent queries ({history.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear all
        </Button>
      </div>

      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="group flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 hover:border-border transition-colors"
          >
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />

            <button
              onClick={() => onReplay(entry.query, entry.services)}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-xs font-medium truncate">{entry.query}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.executedAt), { addSuffix: true })}
                </span>
                <Badge variant="secondary" className="text-[9px] border-transparent">
                  {entry.totalResults} result{entry.totalResults !== 1 ? "s" : ""}
                </Badge>
                {entry.services.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[9px] border-transparent text-muted-foreground">
                    {s}
                  </Badge>
                ))}
              </div>
            </button>

            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReplay(entry.query, entry.services)}
                className="h-6 w-6 p-0"
                title="Re-run query"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(entry.id)}
                className="h-6 w-6 p-0 hover:text-destructive"
                title="Remove from history"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
