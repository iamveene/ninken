"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import {
  Search,
  Shield,
  Key,
  Code,
  Lock,
  Database,
  Fingerprint,
  Webhook,
  Play,
  StopCircle,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  ExternalLink,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CollectButton } from "@/components/collection/collect-button"
import {
  SECRET_PATTERNS,
  SECRET_CATEGORIES,
  searchPatterns,
  detectSecrets,
  type SecretPattern,
  type SecretCategory,
  type SecretSeverity,
} from "@/lib/tools/secret-patterns"
import { executeQuery } from "@/lib/audit/query-engine"
import type {
  ServiceId,
  AggregatedResults,
  QueryResultItem,
} from "@/lib/audit/query-types"
import type { LucideIcon } from "lucide-react"

// ── Constants ─────────────────────────────────────────────────

const CATEGORY_ICONS: Record<SecretCategory, LucideIcon> = {
  "cloud-keys": Key,
  tokens: Code,
  "private-keys": Lock,
  credentials: Shield,
  "connection-strings": Database,
  pii: Fingerprint,
  webhooks: Webhook,
}

const SEVERITY_COLORS: Record<SecretSeverity, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
}

const SERVICE_COLORS: Record<string, string> = {
  gmail: "text-red-400",
  drive: "text-blue-400",
  calendar: "text-green-400",
  buckets: "text-amber-400",
  outlook: "text-blue-400",
  onedrive: "text-sky-400",
}

// ── Types ─────────────────────────────────────────────────────

type SecretFinding = {
  item: QueryResultItem
  pattern: SecretPattern
  matchedText: string
}

type ScanState = {
  status: "idle" | "scanning" | "done"
  currentPatternIdx: number
  totalPatterns: number
  currentPatternName: string
  findings: SecretFinding[]
  errors: string[]
  scannedPatterns: number
}

type Props = {
  services: ServiceId[]
  providerLabel: string
}

// ── Component ─────────────────────────────────────────────────

export function SecretSearchPage({ services, providerLabel }: Props) {
  const [customQuery, setCustomQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<SecretCategory | "all">("all")
  const [severityFilter, setSeverityFilter] = useState<SecretSeverity | "all">("all")
  const [patternFilter, setPatternFilter] = useState("")
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    currentPatternIdx: 0,
    totalPatterns: 0,
    currentPatternName: "",
    findings: [],
    errors: [],
    scannedPatterns: 0,
  })
  const [customResults, setCustomResults] = useState<AggregatedResults | null>(null)
  const [isCustomSearching, setIsCustomSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // ── Filtered patterns for the library view ──────────────────

  const filteredPatterns = useMemo(() => {
    let patterns = patternFilter ? searchPatterns(patternFilter) : SECRET_PATTERNS
    if (categoryFilter !== "all") {
      patterns = patterns.filter((p) => p.category === categoryFilter)
    }
    if (severityFilter !== "all") {
      patterns = patterns.filter((p) => p.severity === severityFilter)
    }
    return patterns
  }, [patternFilter, categoryFilter, severityFilter])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of SECRET_PATTERNS) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return counts
  }, [])

  // ── Custom search ───────────────────────────────────────────

  const runCustomSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsCustomSearching(true)
      setCustomResults(null)

      try {
        const results = await executeQuery(q, services, {
          limit: 50,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setCustomResults(results)
        }
      } catch {
        // aborted or error
      } finally {
        if (!controller.signal.aborted) {
          setIsCustomSearching(false)
        }
      }
    },
    [services]
  )

  // ── Scan All patterns ───────────────────────────────────────

  const scanAll = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const patternsToScan = filteredPatterns.length > 0 ? filteredPatterns : SECRET_PATTERNS

    setScanState({
      status: "scanning",
      currentPatternIdx: 0,
      totalPatterns: patternsToScan.length,
      currentPatternName: patternsToScan[0]?.name ?? "",
      findings: [],
      errors: [],
      scannedPatterns: 0,
    })

    const allFindings: SecretFinding[] = []
    const allErrors: string[] = []

    for (let i = 0; i < patternsToScan.length; i++) {
      if (controller.signal.aborted) break

      const pattern = patternsToScan[i]

      setScanState((prev) => ({
        ...prev,
        currentPatternIdx: i,
        currentPatternName: pattern.name,
      }))

      try {
        const results = await executeQuery(pattern.searchQuery, services, {
          limit: 10,
          signal: controller.signal,
        })

        if (controller.signal.aborted) break

        // Check each result item for actual regex matches
        for (const serviceResult of results.results) {
          for (const item of serviceResult.items) {
            const textToCheck = `${item.title} ${item.snippet}`
            const matches = detectSecrets(textToCheck, [pattern])
            if (matches.length > 0) {
              allFindings.push({
                item,
                pattern,
                matchedText: matches[0].match,
              })
            } else {
              // Even without regex match, the search API found it relevant
              allFindings.push({
                item,
                pattern,
                matchedText: pattern.searchQuery,
              })
            }
          }
        }

        // Collect errors
        for (const serviceResult of results.results) {
          if (serviceResult.error) {
            allErrors.push(`${pattern.name} / ${serviceResult.service}: ${serviceResult.error}`)
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          allErrors.push(`${pattern.name}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
      }

      setScanState((prev) => ({
        ...prev,
        findings: [...allFindings],
        errors: [...allErrors],
        scannedPatterns: i + 1,
      }))
    }

    if (!controller.signal.aborted) {
      setScanState((prev) => ({
        ...prev,
        status: "done",
        scannedPatterns: patternsToScan.length,
      }))
    }
  }, [filteredPatterns, services])

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    setScanState((prev) => ({ ...prev, status: "done" }))
  }, [])

  const clearScan = useCallback(() => {
    setScanState({
      status: "idle",
      currentPatternIdx: 0,
      totalPatterns: 0,
      currentPatternName: "",
      findings: [],
      errors: [],
      scannedPatterns: 0,
    })
    setCustomResults(null)
  }, [])

  // ── Deduplicated findings ───────────────────────────────────

  const deduplicatedFindings = useMemo(() => {
    const seen = new Set<string>()
    return scanState.findings.filter((f) => {
      const key = `${f.item.service}:${f.item.id}:${f.pattern.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [scanState.findings])

  // Severity-sorted findings
  const sortedFindings = useMemo(() => {
    const severityOrder: Record<SecretSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    }
    return [...deduplicatedFindings].sort(
      (a, b) => severityOrder[a.pattern.severity] - severityOrder[b.pattern.severity]
    )
  }, [deduplicatedFindings])

  // ── Finding severity breakdown ──────────────────────────────

  const severityBreakdown = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const f of deduplicatedFindings) {
      counts[f.pattern.severity]++
    }
    return counts
  }, [deduplicatedFindings])

  // ── Render ──────────────────────────────────────────────────

  const isScanning = scanState.status === "scanning"
  const hasResults = scanState.status === "done" && deduplicatedFindings.length > 0
  const progress = scanState.totalPatterns > 0
    ? Math.round((scanState.scannedPatterns / scanState.totalPatterns) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Secret Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scan {providerLabel} for exposed credentials, API keys, tokens, private keys,
          and sensitive data using {SECRET_PATTERNS.length}+ detection patterns.
        </p>
      </div>

      {/* Custom search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                runCustomSearch(customQuery)
              }
            }}
            placeholder="Custom search (e.g., password, AKIA, private key)..."
            className="pl-9 pr-9"
          />
          {customQuery && !isCustomSearching && (
            <button
              onClick={() => {
                setCustomQuery("")
                setCustomResults(null)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isCustomSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <Button
          size="sm"
          onClick={() => runCustomSearch(customQuery)}
          disabled={!customQuery.trim() || isCustomSearching}
          className="shrink-0"
        >
          <Search className="h-4 w-4 mr-1" />
          Search
        </Button>
      </div>

      {/* Custom search results */}
      {customResults && (
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">
                Custom search: &ldquo;{customResults.query}&rdquo;
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {customResults.totalItems} result{customResults.totalItems !== 1 ? "s" : ""}
              </Badge>
            </div>
            {customResults.totalItems === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No results found.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {customResults.results.flatMap((r) =>
                  r.items.map((item) => (
                    <FindingResultRow
                      key={`${item.service}-${item.id}`}
                      item={item}
                      patternName="Custom"
                      severity="medium"
                      matchedText={customResults.query}
                    />
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scan controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {isScanning ? (
          <Button variant="destructive" size="sm" onClick={stopScan}>
            <StopCircle className="h-4 w-4 mr-1" />
            Stop Scan
          </Button>
        ) : (
          <Button size="sm" onClick={scanAll} disabled={isCustomSearching}>
            <Play className="h-4 w-4 mr-1" />
            {scanState.status === "done" ? "Re-scan" : "Scan All"}
            <span className="ml-1 text-muted-foreground">
              ({filteredPatterns.length} patterns)
            </span>
          </Button>
        )}
        {(scanState.status === "done" || deduplicatedFindings.length > 0) && (
          <Button variant="ghost" size="sm" onClick={clearScan}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        {/* Severity breakdown badges */}
        {deduplicatedFindings.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {severityBreakdown.critical > 0 && (
              <Badge className={`text-[10px] ${SEVERITY_COLORS.critical}`}>
                {severityBreakdown.critical} critical
              </Badge>
            )}
            {severityBreakdown.high > 0 && (
              <Badge className={`text-[10px] ${SEVERITY_COLORS.high}`}>
                {severityBreakdown.high} high
              </Badge>
            )}
            {severityBreakdown.medium > 0 && (
              <Badge className={`text-[10px] ${SEVERITY_COLORS.medium}`}>
                {severityBreakdown.medium} medium
              </Badge>
            )}
            {severityBreakdown.low > 0 && (
              <Badge className={`text-[10px] ${SEVERITY_COLORS.low}`}>
                {severityBreakdown.low} low
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {isScanning && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanning: {scanState.currentPatternName}
            </span>
            <span>
              {scanState.scannedPatterns}/{scanState.totalPatterns} patterns ({progress}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {deduplicatedFindings.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {deduplicatedFindings.length} finding{deduplicatedFindings.length !== 1 ? "s" : ""} so far...
            </p>
          )}
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border/50 pb-2">
        <span className="text-xs text-muted-foreground mr-1">Category:</span>
        <Button
          variant={categoryFilter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
          className="h-6 text-[10px] px-2"
        >
          All ({SECRET_PATTERNS.length})
        </Button>
        {(Object.entries(SECRET_CATEGORIES) as [SecretCategory, (typeof SECRET_CATEGORIES)[SecretCategory]][]).map(
          ([key, meta]) => {
            const count = categoryCounts[key] ?? 0
            const Icon = CATEGORY_ICONS[key]
            return (
              <Button
                key={key}
                variant={categoryFilter === key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === key ? "all" : key)}
                className="h-6 text-[10px] px-2 gap-1"
              >
                <Icon className="h-3 w-3" />
                {meta.label}
                <span className="text-muted-foreground">({count})</span>
              </Button>
            )
          }
        )}
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Severity:</span>
        <Button
          variant={severityFilter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setSeverityFilter("all")}
          className="h-6 text-[10px] px-2"
        >
          All
        </Button>
        {(["critical", "high", "medium", "low"] as SecretSeverity[]).map((sev) => (
          <Button
            key={sev}
            variant={severityFilter === sev ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
            className={`h-6 text-[10px] px-2 ${
              severityFilter === sev ? SEVERITY_COLORS[sev] : ""
            }`}
          >
            {sev}
          </Button>
        ))}
      </div>

      {/* Pattern library (when idle or scanning) */}
      {scanState.status === "idle" && (
        <>
          {/* Pattern search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={patternFilter}
              onChange={(e) => setPatternFilter(e.target.value)}
              placeholder="Filter patterns..."
              className="pl-9 h-8 text-xs"
            />
          </div>

          {/* Pattern list */}
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {filteredPatterns.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No patterns match your filter.
              </p>
            ) : (
              filteredPatterns.map((p) => {
                const Icon = CATEGORY_ICONS[p.category]
                const sevColor = SEVERITY_COLORS[p.severity]
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCustomQuery(p.searchQuery)
                      runCustomSearch(p.searchQuery)
                    }}
                    className="w-full text-left rounded-lg border border-border/50 bg-card p-2.5 transition-colors hover:border-border hover:bg-muted/30 group cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">{p.name}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] ${sevColor} border-transparent shrink-0`}
                          >
                            {p.severity}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {p.description}
                        </p>
                        <code className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 block truncate">
                          {p.searchQuery}
                        </code>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Scan errors */}
      {scanState.errors.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-950/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-200">
                {scanState.errors.length} error{scanState.errors.length !== 1 ? "s" : ""} during scan
              </span>
            </div>
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {scanState.errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-[10px] text-amber-200/70">
                  {err}
                </p>
              ))}
              {scanState.errors.length > 10 && (
                <p className="text-[10px] text-amber-200/50">
                  ...and {scanState.errors.length - 10} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan results */}
      {(hasResults || (isScanning && deduplicatedFindings.length > 0)) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">
              {deduplicatedFindings.length} finding{deduplicatedFindings.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              from {scanState.scannedPatterns} pattern{scanState.scannedPatterns !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {sortedFindings.map((f, idx) => (
              <FindingResultRow
                key={`${f.item.service}-${f.item.id}-${f.pattern.id}-${idx}`}
                item={f.item}
                patternName={f.pattern.name}
                severity={f.pattern.severity}
                matchedText={f.matchedText}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scan complete, no findings */}
      {scanState.status === "done" && deduplicatedFindings.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <FileSearch className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No secrets found</p>
          <p className="text-xs text-muted-foreground">
            Scanned {scanState.scannedPatterns} patterns across {services.length} service
            {services.length !== 1 ? "s" : ""}. No exposed credentials detected.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Finding Result Row ────────────────────────────────────────

function FindingResultRow({
  item,
  patternName,
  severity,
  matchedText,
}: {
  item: QueryResultItem
  patternName: string
  severity: SecretSeverity
  matchedText: string
}) {
  const color = SERVICE_COLORS[item.service] ?? "text-muted-foreground"
  const sevColor = SEVERITY_COLORS[severity]

  return (
    <div className="group flex gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border hover:bg-muted/30">
      <div className={`shrink-0 mt-0.5 ${color}`}>
        <Shield className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start gap-2">
          <h4 className="text-sm font-medium truncate flex-1">{item.title}</h4>
          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <CollectButton
              variant="icon-xs"
              params={{
                type: "audit-finding",
                source: "secret-search",
                title: item.title,
                subtitle: `Secret: ${patternName}`,
                sourceId: `secret:${item.service}:${item.id}`,
                metadata: {
                  ...item.metadata,
                  service: item.service,
                  snippet: item.snippet,
                  url: item.url,
                  date: item.date,
                  patternName,
                  severity,
                  matchedText,
                },
              }}
            />
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {item.snippet && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.snippet}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={`text-[10px] ${color} bg-transparent border-current/20`}>
            {item.service}
          </Badge>
          <Badge variant="secondary" className={`text-[9px] ${sevColor} border-transparent`}>
            {severity}
          </Badge>
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
            {patternName}
          </span>
          {matchedText && matchedText !== patternName && (
            <code className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[200px]">
              {matchedText}
            </code>
          )}
        </div>
      </div>
    </div>
  )
}
