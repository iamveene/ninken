"use client"

import { useState, useMemo } from "react"
import { FileSearch, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ResultItem } from "./result-item"
import type { AggregatedResults, ServiceId } from "@/lib/audit/query-types"

type QueryResultsProps = {
  results: AggregatedResults | null
  isExecuting: boolean
}

export function QueryResults({ results, isExecuting }: QueryResultsProps) {
  const [serviceFilter, setServiceFilter] = useState<ServiceId | "all">("all")

  const serviceBreakdown = useMemo(() => {
    if (!results) return []
    return results.results
      .filter((r) => r.items.length > 0 || r.error)
      .map((r) => ({
        service: r.service,
        count: r.items.length,
        error: r.error,
        durationMs: r.durationMs,
      }))
  }, [results])

  const filteredItems = useMemo(() => {
    if (!results) return []
    const allItems = results.results.flatMap((r) => r.items)
    if (serviceFilter === "all") return allItems
    return allItems.filter((item) => item.service === serviceFilter)
  }, [results, serviceFilter])

  const errors = useMemo(() => {
    if (!results) return []
    return results.results.filter((r) => r.error && !r.items.length)
  }, [results])

  if (!results && !isExecuting) return null

  if (isExecuting && !results) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <FileSearch className="h-8 w-8 text-muted-foreground/50 animate-pulse" />
        <p className="text-sm text-muted-foreground">Searching across services...</p>
      </div>
    )
  }

  if (results && results.totalItems === 0 && errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <FileSearch className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No results found</p>
        <p className="text-xs text-muted-foreground">
          Try a different query or broader search terms.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Service filter tabs */}
      {serviceBreakdown.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={serviceFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setServiceFilter("all")}
            className="h-7 text-xs"
          >
            All
            <span className="ml-1 text-muted-foreground">{results?.totalItems ?? 0}</span>
          </Button>
          {serviceBreakdown.map((s) => (
            <Button
              key={s.service}
              variant={serviceFilter === s.service ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setServiceFilter(s.service)}
              className="h-7 text-xs"
            >
              {s.service}
              <span className="ml-1 text-muted-foreground">{s.count}</span>
              {s.error && (
                <AlertTriangle className="ml-0.5 h-3 w-3 text-amber-400" />
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((r) => (
            <Card key={r.service} className="border-amber-500/30 bg-amber-950/10">
              <CardContent className="flex items-center gap-2 py-2 px-3 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="font-medium text-amber-200">{r.service}:</span>
                <span className="text-amber-200/80">{r.error}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results list */}
      <div className="space-y-2">
        {filteredItems.map((item) => (
          <ResultItem key={`${item.service}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  )
}
