"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronRight, Clock, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ProxyResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  timeMs: number
}

function statusVariant(status: number): "default" | "secondary" | "destructive" | "outline" {
  if (status === 0) return "outline"
  if (status < 300) return "default"
  if (status < 400) return "secondary"
  return "destructive"
}

function statusBgClass(status: number): string {
  if (status === 0) return ""
  if (status < 300) return "bg-emerald-600"
  if (status < 400) return "bg-amber-600"
  return "bg-red-600"
}

function tryPrettyJson(raw: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(raw)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: raw, isJson: false }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Inline JSON syntax highlighting using spans with inline color styles. */
function highlightJson(json: string): React.ReactNode[] {
  const lines = json.split("\n")
  return lines.map((line, i) => {
    // HTML-escape first to prevent XSS from response data, then highlight
    const escaped = escapeHtml(line)
    const highlighted = escaped.replace(
      /("(?:[^"\\]|\\.)*")\s*(:)?|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
      (match, str, colon, bool, num) => {
        if (str && colon) {
          return `<span style="color:#7dd3fc">${str}</span>:`
        }
        if (str) {
          return `<span style="color:#86efac">${str}</span>`
        }
        if (bool) {
          return `<span style="color:#fbbf24">${bool}</span>`
        }
        if (num) {
          return `<span style="color:#c4b5fd">${num}</span>`
        }
        return match
      },
    )
    return (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
        {i < lines.length - 1 && "\n"}
      </span>
    )
  })
}

interface ResponseViewerProps {
  response: ProxyResponse | null
  loading: boolean
}

export function ResponseViewer({ response, loading }: ResponseViewerProps) {
  const [headersExpanded, setHeadersExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const body = useMemo(() => {
    if (!response) return null
    return tryPrettyJson(response.body)
  }, [response])

  const copyBody = () => {
    if (!response) return
    navigator.clipboard.writeText(response.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Sending request...</span>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-xs text-muted-foreground">Send a request to see the response.</span>
      </div>
    )
  }

  const headerEntries = Object.entries(response.headers)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        <Badge variant={statusVariant(response.status)} className={`text-[10px] ${statusBgClass(response.status)}`}>
          {response.status} {response.statusText}
        </Badge>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <Clock className="h-3 w-3" />
          {response.timeMs}ms
        </div>
      </div>

      {/* Response headers (collapsible) */}
      {headerEntries.length > 0 && (
        <div className="border-b border-border/40 shrink-0">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setHeadersExpanded((v) => !v)}
          >
            {headersExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Response Headers
            <Badge variant="outline" className="text-[8px] ml-1">{headerEntries.length}</Badge>
          </button>
          {headersExpanded && (
            <div className="px-3 pb-2 space-y-0.5">
              {headerEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2 text-[10px] font-mono">
                  <span className="text-muted-foreground shrink-0">{key}:</span>
                  <span className="text-foreground/80 break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Response body */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute top-1 right-1 z-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={copyBody}
            title="Copy response body"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <ScrollArea className="h-full">
          <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
            {body?.isJson ? highlightJson(body.formatted) : response.body}
          </pre>
        </ScrollArea>
      </div>
    </div>
  )
}
