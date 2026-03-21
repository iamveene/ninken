"use client"

import { useState } from "react"
import { BookOpen, Clock, Search as SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QueryBar } from "@/components/audit/query/query-bar"
import { QueryLibrary } from "@/components/audit/query/query-library"
import { QueryResults } from "@/components/audit/query/query-results"
import { QueryHistory } from "@/components/audit/query/query-history"
import { StealthIndicator } from "@/components/audit/query/stealth-indicator"
import { useAuditQuery } from "@/hooks/use-audit-query"
import { GOOGLE_SERVICES } from "@/lib/audit/query-adapters"

type PanelTab = "library" | "history" | null

export default function AuditQueryPage() {
  const {
    query,
    setQuery,
    results,
    serviceStatuses,
    isExecuting,
    history,
    execute,
    executePrebuilt,
    abort,
    clearResults,
    clearHistory,
    removeHistoryEntry,
  } = useAuditQuery(GOOGLE_SERVICES)

  const [panel, setPanel] = useState<PanelTab>("library")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Audit Query</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-service intelligence search across Google Workspace. Find credentials,
          API keys, PII, and security-relevant data.
        </p>
      </div>

      {/* Query bar */}
      <QueryBar
        query={query}
        onQueryChange={setQuery}
        onExecute={(q) => execute(q)}
        onAbort={abort}
        onClear={clearResults}
        isExecuting={isExecuting}
      />

      {/* Stealth indicator */}
      <StealthIndicator
        statuses={serviceStatuses}
        totalDurationMs={results?.totalDurationMs}
        totalResults={results?.totalItems}
      />

      {/* Panel toggle */}
      <div className="flex gap-1 border-b border-border/50 pb-1">
        <Button
          variant={panel === "library" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setPanel(panel === "library" ? null : "library")}
          className="h-7 text-xs gap-1"
        >
          <BookOpen className="h-3 w-3" />
          Query Library
        </Button>
        <Button
          variant={panel === "history" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setPanel(panel === "history" ? null : "history")}
          className="h-7 text-xs gap-1"
        >
          <Clock className="h-3 w-3" />
          History
          {history.length > 0 && (
            <span className="text-muted-foreground ml-0.5">({history.length})</span>
          )}
        </Button>
        {results && (
          <Button
            variant={panel === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(null)}
            className="h-7 text-xs gap-1"
          >
            <SearchIcon className="h-3 w-3" />
            Results
            <span className="text-muted-foreground ml-0.5">
              ({results.totalItems})
            </span>
          </Button>
        )}
      </div>

      {/* Panel content */}
      {panel === "library" && (
        <QueryLibrary
          onSelect={(prebuilt) => {
            executePrebuilt(prebuilt)
            setPanel(null)
          }}
          availableServices={GOOGLE_SERVICES}
        />
      )}

      {panel === "history" && (
        <QueryHistory
          history={history}
          onReplay={(q, services) => {
            execute(q, services)
            setPanel(null)
          }}
          onRemove={removeHistoryEntry}
          onClearAll={clearHistory}
        />
      )}

      {/* Results */}
      {panel === null && (
        <QueryResults results={results} isExecuting={isExecuting} />
      )}
    </div>
  )
}
