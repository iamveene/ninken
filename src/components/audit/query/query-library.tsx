"use client"

import { useState, useMemo } from "react"
import {
  Key,
  Code,
  Server,
  UserCheck,
  Shield,
  Eye,
  Upload,
  Fingerprint,
  Search,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  PREBUILT_QUERIES,
  QUERY_CATEGORIES,
  searchQueries,
} from "@/lib/audit/query-library"
import type { PrebuiltQuery, QueryCategory, ServiceId } from "@/lib/audit/query-types"
import type { LucideIcon } from "lucide-react"

const CATEGORY_ICONS: Record<QueryCategory, LucideIcon> = {
  credentials: Key,
  "api-keys": Code,
  infrastructure: Server,
  pii: Fingerprint,
  "internal-access": UserCheck,
  security: Shield,
  recon: Eye,
  exfiltration: Upload,
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  info: "text-muted-foreground bg-muted/50 border-border",
}

type QueryLibraryProps = {
  onSelect: (query: PrebuiltQuery) => void
  availableServices: ServiceId[]
}

export function QueryLibrary({ onSelect, availableServices }: QueryLibraryProps) {
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<QueryCategory | "all">("all")

  const filteredQueries = useMemo(() => {
    let queries = search ? searchQueries(search) : PREBUILT_QUERIES
    if (filterCategory !== "all") {
      queries = queries.filter((q) => q.category === filterCategory)
    }
    // Only show queries that have at least one available service
    queries = queries.filter(
      (q) =>
        q.services.length === 0 ||
        q.services.some((s) => availableServices.includes(s))
    )
    return queries
  }, [search, filterCategory, availableServices])

  const groupedQueries = useMemo(() => {
    const groups: Record<string, PrebuiltQuery[]> = {}
    for (const q of filteredQueries) {
      if (!groups[q.category]) groups[q.category] = []
      groups[q.category].push(q)
    }
    return groups
  }, [filteredQueries])

  const categories = Object.entries(QUERY_CATEGORIES) as [QueryCategory, typeof QUERY_CATEGORIES[QueryCategory]][]

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter queries..."
          className="pl-9 h-8 text-xs"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        <Button
          variant={filterCategory === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilterCategory("all")}
          className="h-6 text-[10px] px-2"
        >
          All ({filteredQueries.length})
        </Button>
        {categories.map(([key, meta]) => {
          const count = groupedQueries[key]?.length ?? 0
          if (count === 0 && filterCategory !== key) return null
          const Icon = CATEGORY_ICONS[key]
          return (
            <Button
              key={key}
              variant={filterCategory === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterCategory(filterCategory === key ? "all" : key)}
              className="h-6 text-[10px] px-2 gap-1"
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              <span className="text-muted-foreground">({count})</span>
            </Button>
          )
        })}
      </div>

      {/* Query list */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {filteredQueries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No queries match your filter.
          </p>
        ) : (
          filteredQueries.map((q) => {
            const Icon = CATEGORY_ICONS[q.category]
            const sevColor = SEVERITY_COLORS[q.severity] ?? SEVERITY_COLORS.info
            return (
              <button
                key={q.id}
                onClick={() => onSelect(q)}
                className="w-full text-left rounded-lg border border-border/50 bg-card p-2.5 transition-colors hover:border-border hover:bg-muted/30 group"
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{q.name}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] ${sevColor} border-transparent shrink-0`}
                      >
                        {q.severity}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                      {q.description}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {q.services.map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className={`text-[9px] border-transparent ${
                            availableServices.includes(s)
                              ? "text-muted-foreground"
                              : "text-muted-foreground/40 line-through"
                          }`}
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
