"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { AuthConfig, resolveAuthHeaders, createDefaultAuth, type AuthState } from "./auth-config"
import type { ProxyResponse } from "./response-viewer"
import { addHistoryEntry, type ReplayData } from "./history-panel"

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const

function methodColor(method: string): string {
  switch (method) {
    case "GET": return "bg-emerald-600"
    case "POST": return "bg-blue-600"
    case "PUT": return "bg-amber-600"
    case "PATCH": return "bg-orange-600"
    case "DELETE": return "bg-red-600"
    case "HEAD": return "bg-purple-600"
    case "OPTIONS": return "bg-slate-600"
    default: return "bg-muted"
  }
}

export interface HeaderRow {
  key: string
  value: string
  enabled: boolean
}

interface RequestBuilderProps {
  onResponse: (response: ProxyResponse) => void
  onLoadingChange: (loading: boolean) => void
  replayData: ReplayData | null
  onReplayConsumed: () => void
}

export function RequestBuilder({ onResponse, onLoadingChange, replayData, onReplayConsumed }: RequestBuilderProps) {
  const [method, setMethod] = useState("GET")
  const [url, setUrl] = useState("")
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { key: "Content-Type", value: "application/json", enabled: true },
  ])
  const [body, setBody] = useState("")
  const [auth, setAuth] = useState<AuthState>(createDefaultAuth)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [headersExpanded, setHeadersExpanded] = useState(true)
  const [methodOpen, setMethodOpen] = useState(false)

  // Apply replay data via effect to avoid state mutations during render
  useEffect(() => {
    if (!replayData) return
    setMethod(replayData.method)
    setUrl(replayData.url)
    setHeaders(replayData.headers.length > 0 ? replayData.headers : [{ key: "", value: "", enabled: true }])
    setBody(replayData.body)
    setAuth(replayData.auth)
    onReplayConsumed()
  }, [replayData, onReplayConsumed])

  const addHeader = () => {
    setHeaders((h) => [...h, { key: "", value: "", enabled: true }])
  }

  const removeHeader = (index: number) => {
    setHeaders((h) => h.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: "key" | "value", val: string) => {
    setHeaders((h) => h.map((row, i) => (i === index ? { ...row, [field]: val } : row)))
  }

  const toggleHeader = (index: number) => {
    setHeaders((h) => h.map((row, i) => (i === index ? { ...row, enabled: !row.enabled } : row)))
  }

  const sendRequest = async () => {
    if (!url.trim()) return

    onLoadingChange(true)

    // Merge enabled headers
    const mergedHeaders: Record<string, string> = {}
    for (const h of headers) {
      if (h.enabled && h.key.trim()) {
        mergedHeaders[h.key.trim()] = h.value
      }
    }

    // Merge auth headers
    const authHeaders = resolveAuthHeaders(auth)
    Object.assign(mergedHeaders, authHeaders)

    const payload: Record<string, unknown> = {
      url: url.trim(),
      method,
      headers: mergedHeaders,
    }

    if (body.trim() && !["GET", "HEAD"].includes(method)) {
      payload.body = body
    }

    try {
      const res = await fetch("/api/studio/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      const proxyResponse: ProxyResponse = {
        status: data.status ?? 0,
        statusText: data.statusText ?? "Error",
        headers: data.headers ?? {},
        body: data.body ?? "",
        timeMs: data.timeMs ?? 0,
      }

      onResponse(proxyResponse)

      // Save to history
      addHistoryEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        method,
        url: url.trim(),
        headers,
        body,
        auth,
        responseStatus: proxyResponse.status,
        responseTimeMs: proxyResponse.timeMs,
      })
    } catch {
      onResponse({
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: "Failed to reach the proxy endpoint.",
        timeMs: 0,
      })
    } finally {
      onLoadingChange(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendRequest()
    }
  }

  const enabledHeaderCount = headers.filter((h) => h.enabled && h.key.trim()).length
  const showBody = !["GET", "HEAD"].includes(method)

  return (
    <div className="flex flex-col h-full overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Method + URL + Send */}
      <div className="flex gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        {/* Method selector */}
        <div className="relative">
          <button
            type="button"
            className={`h-8 px-2 rounded-md text-[11px] font-bold text-white cursor-pointer ${methodColor(method)} hover:opacity-90 transition-opacity flex items-center gap-1`}
            onClick={() => setMethodOpen((v) => !v)}
          >
            {method}
            <ChevronDown className="h-3 w-3" />
          </button>
          {methodOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[100px]">
              {HTTP_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`w-full px-3 py-1 text-[11px] font-mono text-left hover:bg-muted transition-colors cursor-pointer ${
                    m === method ? "text-primary font-bold" : "text-foreground"
                  }`}
                  onClick={() => {
                    setMethod(m)
                    setMethodOpen(false)
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="h-8 text-xs font-mono flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              sendRequest()
            }
          }}
        />

        <Button
          size="sm"
          className="h-8 px-3 gap-1.5"
          onClick={sendRequest}
          disabled={!url.trim()}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </div>

      {/* Scrollable config area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Auth config */}
          <AuthConfig value={auth} onChange={setAuth} />

          {/* Headers */}
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={() => setHeadersExpanded((v) => !v)}
            >
              {headersExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Headers
              {enabledHeaderCount > 0 && (
                <Badge variant="outline" className="text-[9px] ml-1">{enabledHeaderCount}</Badge>
              )}
            </button>

            {headersExpanded && (
              <div className="space-y-1.5 pl-5">
                {headers.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleHeader(i)}
                      className="h-3 w-3 rounded border-border accent-primary cursor-pointer"
                    />
                    <Input
                      value={row.key}
                      onChange={(e) => updateHeader(i, "key", e.target.value)}
                      placeholder="Header name"
                      className="h-7 text-[11px] font-mono w-2/5"
                    />
                    <Input
                      value={row.value}
                      onChange={(e) => updateHeader(i, "value", e.target.value)}
                      placeholder="Value"
                      className="h-7 text-[11px] font-mono flex-1"
                    />
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      onClick={() => removeHeader(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground gap-1"
                  onClick={addHeader}
                >
                  <Plus className="h-3 w-3" />
                  Add Header
                </Button>
              </div>
            )}
          </div>

          {/* Body */}
          {showBody && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={() => setBodyExpanded((v) => !v)}
              >
                {bodyExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Body
                {body.trim() && (
                  <Badge variant="outline" className="text-[9px] ml-1">
                    {body.length} chars
                  </Badge>
                )}
              </button>

              {bodyExpanded && (
                <div className="pl-5">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    className="text-[11px] font-mono min-h-24 resize-y"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
