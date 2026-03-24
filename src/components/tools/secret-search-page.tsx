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
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  HardDrive,
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
import { toSecretPattern } from "@/lib/tools/custom-pattern-store"
import { useCustomPatterns } from "@/hooks/use-custom-patterns"
import { executeQuery } from "@/lib/audit/query-engine"
import type {
  ServiceId,
  AggregatedResults,
  QueryResultItem,
} from "@/lib/audit/query-types"
import { ExtractButton } from "@/components/vault/extract-button"
import { AIExtractionToggle } from "@/components/vault/ai-extraction-toggle"
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
  vaultEnabled?: boolean
  providerContext?: { provider: string; service: string }
}

// ── Component ─────────────────────────────────────────────────

export function SecretSearchPage({ services, providerLabel, vaultEnabled = true, providerContext }: Props) {
  const [customQuery, setCustomQuery] = useState("")
  const [aiExtractionEnabled, setAiExtractionEnabled] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<SecretCategory | "all">("all")
  const [severityFilter, setSeverityFilter] = useState<SecretSeverity | "all">("all")
  const [patternFilter, setPatternFilter] = useState("")
  const [searchMode, setSearchMode] = useState<"online" | "offline">("online")
  const [showAddPattern, setShowAddPattern] = useState(false)
  const { patterns: customPatterns, add: addPattern, remove: removePattern } = useCustomPatterns()
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

  // ── Merge built-in + custom patterns ────────────────────────

  const allPatterns = useMemo(() => {
    const converted = customPatterns.map(toSecretPattern)
    return [...SECRET_PATTERNS, ...converted]
  }, [customPatterns])

  // ── Filtered patterns for the library view ──────────────────

  const filteredPatterns = useMemo(() => {
    let patterns = patternFilter
      ? allPatterns.filter(
          (p) =>
            p.name.toLowerCase().includes(patternFilter.toLowerCase()) ||
            p.description.toLowerCase().includes(patternFilter.toLowerCase()) ||
            p.searchQuery.toLowerCase().includes(patternFilter.toLowerCase())
        )
      : allPatterns
    if (categoryFilter !== "all") {
      patterns = patterns.filter((p) => p.category === categoryFilter)
    }
    if (severityFilter !== "all") {
      patterns = patterns.filter((p) => p.severity === severityFilter)
    }
    return patterns
  }, [patternFilter, categoryFilter, severityFilter, allPatterns])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of allPatterns) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return counts
  }, [allPatterns])

  // ── Offline search helper ───────────────────────────────────

  const searchOffline = useCallback(
    async (q: string, signal?: AbortSignal): Promise<AggregatedResults> => {
      const { getAllItems } = await import("@/lib/collection-store")
      const items = await getAllItems({ status: "done" })

      const query = q.toLowerCase()
      const matched: QueryResultItem[] = []

      for (const item of items) {
        if (signal?.aborted) break
        const text = [
          item.title,
          item.subtitle,
          typeof item.metadata === "object" ? JSON.stringify(item.metadata) : "",
        ]
          .join(" ")
          .toLowerCase()

        if (text.includes(query)) {
          matched.push({
            id: item.id,
            service: item.source as ServiceId,
            title: item.title,
            snippet: item.subtitle || "",
            date: new Date(item.collectedAt).toISOString(),
            url: "",
            metadata: (item.metadata ?? {}) as Record<string, unknown>,
          })
        }
      }

      return {
        query: q,
        totalItems: matched.length,
        totalDurationMs: 0,
        completedAt: new Date().toISOString(),
        results: [{
          service: "collection" as ServiceId,
          items: matched,
          totalEstimate: matched.length,
          durationMs: 0,
        }],
      }
    },
    []
  )

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
        const results =
          searchMode === "offline"
            ? await searchOffline(q, controller.signal)
            : await executeQuery(q, services, {
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
    [services, searchMode, searchOffline]
  )

  // ── Scan All patterns ───────────────────────────────────────

  const scanAll = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const patternsToScan = filteredPatterns.length > 0 ? filteredPatterns : allPatterns

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
        const results =
          searchMode === "offline"
            ? await searchOffline(pattern.searchQuery, controller.signal)
            : await executeQuery(pattern.searchQuery, services, {
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
  }, [filteredPatterns, allPatterns, services, searchMode, searchOffline])

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Secret Search</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan {providerLabel} for exposed credentials, API keys, tokens, private keys,
            and sensitive data using {allPatterns.length} detection patterns
            {customPatterns.length > 0 && (
              <span className="text-primary"> ({customPatterns.length} custom)</span>
            )}
            .
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* AI Extraction toggle */}
          {vaultEnabled && providerContext && (
            <AIExtractionToggle
              enabled={aiExtractionEnabled}
              onToggle={setAiExtractionEnabled}
            />
          )}
          {/* Online/Offline toggle */}
          <div className="relative group/toggle">
            <button
              onClick={() => setSearchMode(searchMode === "online" ? "offline" : "online")}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                searchMode === "online"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}
            >
              {searchMode === "online" ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Online
                </>
              ) : (
                <>
                  <HardDrive className="h-3 w-3" />
                  Offline
                </>
              )}
            </button>
            {/* Hover tooltip */}
            <div className="absolute right-0 top-full mt-1.5 z-50 hidden group-hover/toggle:block w-64">
              <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
                <p className="text-xs font-medium mb-1">
                  {searchMode === "online" ? "Online Mode" : "Offline Mode"}
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {searchMode === "online"
                    ? "Searches live service APIs (Gmail, Drive, Outlook, etc.) in real time. Requires active tokens and network connectivity. Results reflect current data in the target environment."
                    : "Searches locally collected items and cached data stored in your browser. No API calls are made — fully air-gapped. Only items previously collected via \"Send to Collection\" are searchable."}
                </p>
              </div>
            </div>
          </div>
          {/* Add pattern button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPattern(!showAddPattern)}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Pattern
          </Button>
        </div>
      </div>

      {/* Add custom pattern form */}
      {showAddPattern && (
        <AddPatternForm
          onAdd={async (p) => {
            await addPattern(p)
            setShowAddPattern(false)
          }}
          onCancel={() => setShowAddPattern(false)}
        />
      )}

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
                      aiExtractionEnabled={aiExtractionEnabled}
                      providerContext={providerContext}
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
          All ({allPatterns.length})
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
                const isCustom = "isCustom" in p && (p as { isCustom?: boolean }).isCustom === true
                return (
                  <div
                    key={p.id}
                    className="w-full text-left rounded-lg border border-border/50 bg-card p-2.5 transition-colors hover:border-border hover:bg-muted/30 group flex items-start gap-2"
                  >
                    <button
                      onClick={() => {
                        setCustomQuery(p.searchQuery)
                        runCustomSearch(p.searchQuery)
                      }}
                      className="flex items-start gap-2 flex-1 min-w-0 text-left cursor-pointer"
                    >
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
                          {isCustom && (
                            <Badge variant="outline" className="text-[9px] shrink-0 border-primary/30 text-primary">
                              custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {p.description}
                        </p>
                        <code className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 block truncate">
                          {p.searchQuery}
                        </code>
                      </div>
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => removePattern(p.id)}
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete custom pattern"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
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
                aiExtractionEnabled={aiExtractionEnabled}
                providerContext={providerContext}
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

// ── Add Pattern Form ─────────────────────────────────────────

function AddPatternForm({
  onAdd,
  onCancel,
}: {
  onAdd: (p: {
    name: string
    regexSource: string
    regexFlags: string
    severity: SecretSeverity
    category: SecretCategory
    description: string
    searchQuery: string
  }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [regexSource, setRegexSource] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState<SecretSeverity>("medium")
  const [category, setCategory] = useState<SecretCategory>("credentials")
  const [saving, setSaving] = useState(false)
  const [regexError, setRegexError] = useState("")

  const handleSave = async () => {
    if (!name.trim() || !searchQuery.trim()) return

    // Validate regex if provided
    if (regexSource.trim()) {
      try {
        new RegExp(regexSource)
        setRegexError("")
      } catch (e) {
        setRegexError(e instanceof Error ? e.message : "Invalid regex")
        return
      }
    }

    setSaving(true)
    await onAdd({
      name: name.trim(),
      searchQuery: searchQuery.trim(),
      regexSource: regexSource.trim() || searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      regexFlags: "i",
      severity,
      category,
      description: description.trim() || `Custom pattern: ${name.trim()}`,
    })
    setSaving(false)
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">New Custom Pattern</span>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Internal API Key"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Search Query *</label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., x-api-key OR api_key"
              className="h-7 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">
            Regex (optional — validates matches)
          </label>
          <Input
            value={regexSource}
            onChange={(e) => {
              setRegexSource(e.target.value)
              setRegexError("")
            }}
            placeholder="e.g., x-api-key[=:]\s*[A-Za-z0-9]{32}"
            className={`h-7 text-xs font-mono ${regexError ? "border-red-500" : ""}`}
          />
          {regexError && (
            <p className="text-[10px] text-red-400 mt-0.5">{regexError}</p>
          )}
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this pattern detect?"
            className="h-7 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SecretSeverity)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SecretCategory)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            >
              {(Object.entries(SECRET_CATEGORIES) as [SecretCategory, { label: string }][]).map(
                ([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="ml-auto flex items-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!name.trim() || !searchQuery.trim() || saving}
              className="h-7 text-xs"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              Save Pattern
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Finding Result Row ────────────────────────────────────────

function FindingResultRow({
  item,
  patternName,
  severity,
  matchedText,
  aiExtractionEnabled,
  providerContext,
}: {
  item: QueryResultItem
  patternName: string
  severity: SecretSeverity
  matchedText: string
  aiExtractionEnabled?: boolean
  providerContext?: { provider: string; service: string }
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
            {aiExtractionEnabled && providerContext && (
              <ExtractButton
                rawText={`${item.title} ${item.snippet} ${matchedText}`}
                patternName={patternName}
                category={severity}
                providerContext={providerContext}
                reference={item.title}
              />
            )}
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
