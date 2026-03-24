"use client"

import { useState } from "react"
import { Crosshair, BookOpen, Clock, Search as SearchIcon } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { SecretSearchPage } from "@/components/tools/secret-search-page"
import { QueryBar } from "@/components/audit/query/query-bar"
import { QueryLibrary } from "@/components/audit/query/query-library"
import { QueryResults } from "@/components/audit/query/query-results"
import { QueryHistory } from "@/components/audit/query/query-history"
import { StealthIndicator } from "@/components/audit/query/stealth-indicator"
import { useAuditQuery } from "@/hooks/use-audit-query"
import { GOOGLE_SERVICES } from "@/lib/audit/query-adapters"
import type { ServiceId } from "@/lib/audit/query-types"

const SECRET_SERVICES: ServiceId[] = ["gmail", "drive", "calendar", "buckets"]

type QueryPanel = "library" | "history" | null

export default function GoogleHuntPage() {
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

  const [queryPanel, setQueryPanel] = useState<QueryPanel>("library")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-muted-foreground" />
          Hunt
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for secrets, credentials, and intelligence across Google Workspace services.
        </p>
      </div>

      <Tabs defaultValue="secrets">
        <TabsList>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="queries">Queries</TabsTrigger>
        </TabsList>

        <TabsContent value="secrets" className="mt-4">
          <SecretSearchPage
            services={SECRET_SERVICES}
            providerLabel="Google Workspace (Gmail, Drive, Calendar, Buckets)"
            providerContext={{ provider: "google", service: "workspace" }}
          />
        </TabsContent>

        <TabsContent value="queries" className="mt-4">
          <div className="flex flex-col gap-4">
            <QueryBar
              query={query}
              onQueryChange={setQuery}
              onExecute={(q) => execute(q)}
              onAbort={abort}
              onClear={clearResults}
              isExecuting={isExecuting}
            />

            <StealthIndicator
              statuses={serviceStatuses}
              totalDurationMs={results?.totalDurationMs}
              totalResults={results?.totalItems}
            />

            <div className="flex gap-1 border-b border-border/50 pb-1">
              <Button
                variant={queryPanel === "library" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setQueryPanel(queryPanel === "library" ? null : "library")}
                className="h-7 text-xs gap-1"
              >
                <BookOpen className="h-3 w-3" />
                Query Library
              </Button>
              <Button
                variant={queryPanel === "history" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setQueryPanel(queryPanel === "history" ? null : "history")}
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
                  variant={queryPanel === null ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setQueryPanel(null)}
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

            {queryPanel === "library" && (
              <QueryLibrary
                onSelect={(prebuilt) => {
                  executePrebuilt(prebuilt)
                  setQueryPanel(null)
                }}
                availableServices={GOOGLE_SERVICES}
              />
            )}

            {queryPanel === "history" && (
              <QueryHistory
                history={history}
                onReplay={(q, services) => {
                  execute(q, services)
                  setQueryPanel(null)
                }}
                onRemove={removeHistoryEntry}
                onClearAll={clearHistory}
              />
            )}

            {queryPanel === null && (
              <QueryResults results={results} isExecuting={isExecuting} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
