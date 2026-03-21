"use client"

import { useState, useCallback, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import type { AuthState } from "./auth-config"

const STORAGE_KEY = "ninken-api-explorer-history"
const MAX_ENTRIES = 100

export interface HistoryEntry {
  id: string
  timestamp: number
  method: string
  url: string
  headers: { key: string; value: string; enabled: boolean }[]
  body: string
  auth: AuthState
  responseStatus: number
  responseTimeMs: number
}

export interface ReplayData {
  method: string
  url: string
  headers: { key: string; value: string; enabled: boolean }[]
  body: string
  auth: AuthState
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // Storage full or unavailable
  }
}

function statusColor(status: number): string {
  if (status === 0) return "text-muted-foreground"
  if (status < 300) return "text-emerald-400"
  if (status < 400) return "text-amber-400"
  return "text-red-400"
}

function methodColor(method: string): string {
  switch (method) {
    case "GET": return "text-emerald-400"
    case "POST": return "text-blue-400"
    case "PUT": return "text-amber-400"
    case "PATCH": return "text-orange-400"
    case "DELETE": return "text-red-400"
    default: return "text-muted-foreground"
  }
}

interface HistoryPanelProps {
  onReplay: (data: ReplayData) => void
}

export function addHistoryEntry(entry: HistoryEntry) {
  const entries = loadHistory()
  entries.unshift(entry)
  saveHistory(entries)
}

export function HistoryPanel({ onReplay }: HistoryPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  // Load on mount and when expanded
  useEffect(() => {
    if (expanded) {
      setEntries(loadHistory())
    }
  }, [expanded])

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setEntries([])
  }, [])

  const handleReplay = useCallback(
    (entry: HistoryEntry) => {
      onReplay({
        method: entry.method,
        url: entry.url,
        headers: entry.headers,
        body: entry.body,
        auth: entry.auth,
      })
    },
    [onReplay],
  )

  return (
    <div className="border-t border-border/40">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <History className="h-3 w-3" />
        History
        {entries.length > 0 && (
          <Badge variant="outline" className="text-[9px] ml-1">{entries.length}</Badge>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {entries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2">No history yet. Send a request to start recording.</p>
          ) : (
            <>
              <div className="flex justify-end mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={clearHistory}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleReplay(entry)}
                    >
                      <span className={`text-[10px] font-mono font-bold w-12 shrink-0 ${methodColor(entry.method)}`}>
                        {entry.method}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate flex-1 min-w-0">
                        {entry.url}
                      </span>
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${statusColor(entry.responseStatus)}`}>
                        {entry.responseStatus || "ERR"}
                      </span>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {entry.responseTimeMs}ms
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </div>
  )
}
