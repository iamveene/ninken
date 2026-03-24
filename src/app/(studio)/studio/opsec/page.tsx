"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { StealthBadge } from "@/components/studio/stealth-badge"
import {
  STEALTH_TIERS,
  scoreOperation,
  type StealthLevel,
} from "@/lib/studio/stealth-scores"
import {
  OPERATION_SCENARIOS,
  DEFENSIVE_CONTROLS,
  ALL_PROVIDERS,
  PROVIDER_LABELS,
  type ProviderFilter,
  type OperationScenario,
  type DefensiveControl,
  type ControlStatus,
  type ControlEffectiveness,
} from "@/lib/studio/opsec-data"
import { cn } from "@/lib/utils"
import {
  Shield,
  Gauge,
  Search,
  Swords,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Eye,
  Lock,
  Radar,
  Zap,
} from "lucide-react"

type TabId = "offensive" | "defensive"

const STEALTH_LEVELS: (StealthLevel | "all")[] = ["all", 1, 2, 3, 4, 5]
const TIER_ORDER: StealthLevel[] = [1, 2, 3, 4, 5]

// ---------------------------------------------------------------------------
// Status & effectiveness badge helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: ControlStatus): string {
  switch (status) {
    case "available":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    case "enabled-by-default":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30"
    case "does-not-exist":
      return "bg-red-500/15 text-red-400 border-red-500/30"
    case "preview":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30"
  }
}

function statusLabel(status: ControlStatus): string {
  switch (status) {
    case "available":
      return "Available"
    case "enabled-by-default":
      return "Default On"
    case "does-not-exist":
      return "Does Not Exist"
    case "preview":
      return "Preview"
  }
}

function effectivenessBadgeClass(eff: ControlEffectiveness): string {
  switch (eff) {
    case "very-high":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    case "high":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30"
    case "medium":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30"
    case "low":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30"
    case "detective-only":
      return "bg-muted text-muted-foreground border-border/50"
  }
}

function categoryIcon(cat: "preventive" | "detective" | "responsive") {
  switch (cat) {
    case "preventive":
      return <Lock className="h-3 w-3" />
    case "detective":
      return <Radar className="h-3 w-3" />
    case "responsive":
      return <Zap className="h-3 w-3" />
  }
}

function categoryBadgeClass(cat: "preventive" | "detective" | "responsive"): string {
  switch (cat) {
    case "preventive":
      return "bg-violet-500/15 text-violet-400 border-violet-500/30"
    case "detective":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
    case "responsive":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30"
  }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OpsecPage() {
  const [activeTab, setActiveTab] = useState<TabId>("offensive")

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          OPSEC
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational security reference. Assess detection risk before executing and understand defensive controls.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-black/20 p-1 w-fit">
        <button
          onClick={() => setActiveTab("offensive")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "offensive"
              ? "bg-primary/15 text-foreground border border-primary/30"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          )}
        >
          <Swords className="h-3.5 w-3.5" />
          Offensive
        </button>
        <button
          onClick={() => setActiveTab("defensive")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "defensive"
              ? "bg-primary/15 text-foreground border border-primary/30"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Defensive
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "offensive" ? <OffensiveTab /> : <DefensiveTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Offensive Tab
// ---------------------------------------------------------------------------

function OffensiveTab() {
  // Stealth calculator state
  const [customParams, setCustomParams] = useState({
    isRead: true,
    isWrite: false,
    isDelete: false,
    targetsAdminApi: false,
    targetsSensitiveData: false,
    isBulkOperation: false,
    createsPeristence: false,
  })
  const customScore = scoreOperation(customParams)
  const toggleParam = (key: keyof typeof customParams) => {
    setCustomParams((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Operation catalog state
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all")
  const [levelFilter, setLevelFilter] = useState<StealthLevel | "all">("all")
  const [searchText, setSearchText] = useState("")
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set())

  const filteredScenarios = useMemo(() => {
    let results = OPERATION_SCENARIOS
    if (providerFilter !== "all") {
      results = results.filter((s) => s.provider === providerFilter)
    }
    if (levelFilter !== "all") {
      results = results.filter((s) => s.stealthLevel === levelFilter)
    }
    if (searchText) {
      const lower = searchText.toLowerCase()
      results = results.filter(
        (s) =>
          s.operation.toLowerCase().includes(lower) ||
          s.api.toLowerCase().includes(lower) ||
          s.service.toLowerCase().includes(lower) ||
          s.detectionVectors.some((d) => d.toLowerCase().includes(lower)) ||
          s.opsecNotes.some((n) => n.toLowerCase().includes(lower))
      )
    }
    return results
  }, [providerFilter, levelFilter, searchText])

  // Group by provider
  const groupedScenarios = useMemo(() => {
    const groups: Record<string, OperationScenario[]> = {}
    for (const s of filteredScenarios) {
      if (!groups[s.provider]) groups[s.provider] = []
      groups[s.provider].push(s)
    }
    return groups
  }, [filteredScenarios])

  const toggleProviderCollapse = (provider: string) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  const paramLabels: Record<string, string> = {
    isRead: "Read Operation",
    isWrite: "Write Operation",
    isDelete: "Delete Operation",
    targetsAdminApi: "Admin API",
    targetsSensitiveData: "Sensitive Data",
    isBulkOperation: "Bulk Operation",
    createsPeristence: "Creates Persistence",
  }

  return (
    <div className="space-y-6">
      {/* Stealth Calculator */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Stealth Calculator
          </CardTitle>
          <CardDescription className="text-xs">
            Toggle operation characteristics to estimate detection risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(customParams) as (keyof typeof customParams)[]).map((key) => (
              <button
                key={key}
                onClick={() => toggleParam(key)}
                className={cn(
                  "flex items-center gap-2 rounded border px-3 py-2 text-xs transition-colors",
                  customParams[key]
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/30 bg-black/10 text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded border shrink-0",
                    customParams[key] ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}
                />
                {paramLabels[key]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded border border-border/50 bg-black/20 px-4 py-3">
            <span className="text-xs text-muted-foreground">Estimated Detection Level:</span>
            <StealthBadge level={customScore} size="md" />
            <span className="text-xs text-muted-foreground ml-auto">
              Detection probability: {STEALTH_TIERS[customScore].detectionProbability}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tier Reference (collapsed) */}
      <TierReference />

      {/* Operation Catalog */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Eye className="h-3.5 w-3.5" />
          Operation Catalog
          <Badge variant="outline" className="text-[9px] ml-1">{filteredScenarios.length}</Badge>
        </h2>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as ProviderFilter)}
            className="h-8 rounded border border-border/50 bg-black/20 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="all">All Providers</option>
            {ALL_PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>

          {/* Level filter */}
          <select
            value={String(levelFilter)}
            onChange={(e) => {
              const val = e.target.value
              setLevelFilter(val === "all" ? "all" : (Number(val) as StealthLevel))
            }}
            className="h-8 rounded border border-border/50 bg-black/20 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="all">All Levels</option>
            {TIER_ORDER.map((l) => (
              <option key={l} value={String(l)}>
                Level {l} — {STEALTH_TIERS[l].codename}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search operations, APIs, detection vectors..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Grouped results */}
        {Object.keys(groupedScenarios).length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-xs text-muted-foreground">
              No operations match the current filters.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ALL_PROVIDERS.filter((p) => groupedScenarios[p]).map((provider) => {
              const scenarios = groupedScenarios[provider]!
              const isCollapsed = collapsedProviders.has(provider)
              return (
                <div key={provider} className="space-y-1.5">
                  <button
                    onClick={() => toggleProviderCollapse(provider)}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {PROVIDER_LABELS[provider]}
                    <Badge variant="outline" className="text-[9px]">{scenarios.length}</Badge>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-1.5 ml-5">
                      {scenarios.map((scenario) => (
                        <ScenarioCard key={scenario.id} scenario={scenario} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tier Reference (collapsible)
// ---------------------------------------------------------------------------

function TierReference() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Shield className="h-3.5 w-3.5" />
        Stealth Tier Reference
      </button>

      {expanded && (
        <div className="space-y-2 ml-5">
          {TIER_ORDER.map((level) => {
            const tier = STEALTH_TIERS[level]
            return (
              <Card key={level} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <StealthBadge level={level} size="md" />
                    <div>
                      <CardTitle className="text-sm">{tier.name}</CardTitle>
                      <CardDescription className="text-xs">{tier.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                      {tier.detectionProbability}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        Example Operations
                      </h4>
                      <ul className="space-y-1">
                        {tier.examples.map((ex, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px]">
                            <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                            <span className="text-muted-foreground">{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        OPSEC Guidance
                      </h4>
                      <ul className="space-y-1">
                        {tier.guidance.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px]">
                            <span className="mt-1 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                            <span className="text-muted-foreground">{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scenario Card
// ---------------------------------------------------------------------------

function ScenarioCard({ scenario }: { scenario: OperationScenario }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="border-border/50">
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <StealthBadge level={scenario.stealthLevel} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium">{scenario.operation}</div>
          <div className="text-[10px] text-muted-foreground font-mono truncate">{scenario.api}</div>
        </div>
        <Badge variant="outline" className="text-[9px] shrink-0">{scenario.service}</Badge>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-2">
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Detection Vectors
            </h4>
            <div className="flex flex-wrap gap-1">
              {scenario.detectionVectors.map((d, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/5 px-1.5 py-0.5 text-[10px] text-red-400"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              OPSEC Notes
            </h4>
            <ul className="space-y-0.5">
              {scenario.opsecNotes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-1 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                  <span className="text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Defensive Tab
// ---------------------------------------------------------------------------

function DefensiveTab() {
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set())

  const toggleProviderCollapse = (provider: string) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  // Stats
  const stats = useMemo(() => {
    const counts = { available: 0, "enabled-by-default": 0, "does-not-exist": 0, preview: 0 }
    for (const c of DEFENSIVE_CONTROLS) {
      counts[c.status]++
    }
    return counts
  }, [])

  // Group by provider
  const grouped = useMemo(() => {
    const groups: Record<string, DefensiveControl[]> = {}
    for (const c of DEFENSIVE_CONTROLS) {
      if (!groups[c.provider]) groups[c.provider] = []
      groups[c.provider].push(c)
    }
    return groups
  }, [])

  // Count "does not exist" per provider
  const gapCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of DEFENSIVE_CONTROLS) {
      if (c.status === "does-not-exist") {
        counts[c.provider] = (counts[c.provider] || 0) + 1
      }
    }
    return counts
  }, [])

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Available" count={stats.available} colorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/30" />
        <StatCard label="Default On" count={stats["enabled-by-default"]} colorClass="text-amber-400 bg-amber-500/10 border-amber-500/30" />
        <StatCard label="Does Not Exist" count={stats["does-not-exist"]} colorClass="text-red-400 bg-red-500/10 border-red-500/30" />
        <StatCard label="Preview" count={stats.preview} colorClass="text-sky-400 bg-sky-500/10 border-sky-500/30" />
      </div>

      {/* Attack surface gaps highlight */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Attack Surface Gaps
          </CardTitle>
          <CardDescription className="text-xs">
            Controls that do not exist represent exploitable gaps in the defensive posture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {DEFENSIVE_CONTROLS.filter((c) => c.status === "does-not-exist").map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5 shrink-0 rounded border border-red-500/30 bg-red-500/15 px-1 py-0.5 text-[9px] text-red-400 font-mono uppercase">
                  {c.provider}
                </span>
                <div>
                  <span className="font-medium text-foreground">{c.control}</span>
                  <span className="text-muted-foreground"> -- {c.notes}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider sections */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Controls by Provider
        </h2>

        {ALL_PROVIDERS.map((provider) => {
          const controls = grouped[provider] || []
          const isCollapsed = collapsedProviders.has(provider)
          const gaps = gapCounts[provider] || 0

          return (
            <div key={provider} className="space-y-2">
              <button
                onClick={() => toggleProviderCollapse(provider)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {PROVIDER_LABELS[provider]}
                <Badge variant="outline" className="text-[9px]">{controls.length} controls</Badge>
                {gaps > 0 && (
                  <Badge variant="outline" className="text-[9px] text-red-400 border-red-500/30">
                    {gaps} gap{gaps > 1 ? "s" : ""}
                  </Badge>
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-1.5 ml-5">
                  {controls.map((control) => (
                    <ControlCard key={control.id} control={control} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  count,
  colorClass,
}: {
  label: string
  count: number
  colorClass: string
}) {
  return (
    <Card className={cn("border", colorClass.split(" ").find((c) => c.startsWith("border-")) || "border-border/50")}>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <span className={cn("text-2xl font-bold font-mono", colorClass.split(" ").find((c) => c.startsWith("text-")))}>{count}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Control Card
// ---------------------------------------------------------------------------

function ControlCard({ control }: { control: DefensiveControl }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card
      className={cn(
        "border-border/50",
        control.status === "does-not-exist" && "border-red-500/20 bg-red-500/[0.02]"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium flex items-center gap-2">
            {control.control}
          </div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{control.description}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status badge */}
          <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase", statusBadgeClass(control.status))}>
            {statusLabel(control.status)}
          </span>
          {/* Effectiveness badge */}
          <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase", effectivenessBadgeClass(control.effectiveness))}>
            {control.effectiveness}
          </span>
          {/* Category badge */}
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase", categoryBadgeClass(control.category))}>
            {categoryIcon(control.category)}
            {control.category}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border/30 pt-2">
          <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <Shield className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400/80">{control.notes}</span>
          </div>
        </div>
      )}
    </Card>
  )
}
