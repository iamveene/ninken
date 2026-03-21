"use client"

import { useCallback, type KeyboardEvent } from "react"
import { Search, X, Loader2, StopCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ServiceId } from "@/lib/audit/query-types"

type QueryBarProps = {
  query: string
  onQueryChange: (query: string) => void
  onExecute: (query: string, services?: ServiceId[]) => void
  onAbort: () => void
  onClear: () => void
  isExecuting: boolean
  placeholder?: string
}

export function QueryBar({
  query,
  onQueryChange,
  onExecute,
  onAbort,
  onClear,
  isExecuting,
  placeholder = "Search across services... (e.g., password, AKIA, vpn config)",
}: QueryBarProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (isExecuting) {
          onAbort()
        } else {
          onExecute(query)
        }
      }
      if (e.key === "Escape") {
        if (isExecuting) {
          onAbort()
        } else {
          onClear()
        }
      }
    },
    [query, isExecuting, onExecute, onAbort, onClear]
  )

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {query && !isExecuting && (
          <button
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isExecuting && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {isExecuting ? (
        <Button variant="destructive" size="sm" onClick={onAbort} className="shrink-0">
          <StopCircle className="h-4 w-4 mr-1" />
          Stop
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => onExecute(query)}
          disabled={!query.trim()}
          className="shrink-0"
        >
          <Search className="h-4 w-4 mr-1" />
          Search
        </Button>
      )}
    </div>
  )
}
