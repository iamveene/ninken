"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  EXTRACTION_TECHNIQUES,
  type OperatingSystem,
  type DifficultyLevel,
} from "@/lib/studio/extraction-database"
import { cn } from "@/lib/utils"
import {
  FileDown,
  Search,
  Monitor,
  Laptop,
  Terminal,
  Globe,
  Smartphone,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const OS_ICONS: Record<OperatingSystem, LucideIcon> = {
  windows: Monitor,
  macos: Laptop,
  linux: Terminal,
  browser: Globe,
  mobile: Smartphone,
}

const OS_LABELS: Record<OperatingSystem, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  browser: "Browser",
  mobile: "Mobile",
}

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  easy: "text-emerald-400 bg-emerald-500/10",
  medium: "text-amber-400 bg-amber-500/10",
  hard: "text-orange-400 bg-orange-500/10",
  expert: "text-red-400 bg-red-500/10",
}

const OS_ORDER: OperatingSystem[] = ["windows", "macos", "linux", "browser", "mobile"]

export default function ExtractionGuidePage() {
  const [search, setSearch] = useState("")
  const [selectedOS, setSelectedOS] = useState<OperatingSystem | "all">("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let result = EXTRACTION_TECHNIQUES
    if (selectedOS !== "all") {
      result = result.filter((t) => t.os === selectedOS)
    }
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          t.source.toLowerCase().includes(lower) ||
          t.tokenType.toLowerCase().includes(lower) ||
          t.tools.some((tool) => tool.toLowerCase().includes(lower)) ||
          t.platform.toLowerCase().includes(lower)
      )
    }
    return result
  }, [search, selectedOS])

  // Group by OS
  const grouped = useMemo(() => {
    const map = new Map<OperatingSystem, typeof filtered>()
    for (const os of OS_ORDER) {
      const items = filtered.filter((t) => t.os === os)
      if (items.length > 0) map.set(os, items)
    }
    return map
  }, [filtered])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileDown className="h-5 w-5 text-muted-foreground" />
          Extraction Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Token extraction techniques organized by OS and platform. Includes tools, file paths, and detection considerations.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search techniques, tools, sources..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors",
              selectedOS === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSelectedOS("all")}
          >
            All
          </button>
          {OS_ORDER.map((os) => {
            const Icon = OS_ICONS[os]
            return (
              <button
                key={os}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors",
                  selectedOS === os ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedOS(os)}
              >
                <Icon className="h-3 w-3" />
                {OS_LABELS[os]}
              </button>
            )
          })}
        </div>
      </div>

      {Array.from(grouped.entries()).map(([os, techniques]) => {
        const Icon = OS_ICONS[os]
        return (
          <div key={os} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {OS_LABELS[os]}
              </h2>
              <Badge variant="outline" className="text-[9px]">{techniques.length}</Badge>
            </div>

            <div className="space-y-2">
              {techniques.map((tech) => {
                const isExpanded = expandedIds.has(tech.id)
                return (
                  <Card key={tech.id} className="border-border/50 bg-card/50">
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleExpand(tech.id)}>
                      <div className="flex items-start gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            {tech.name}
                            <Badge className={cn("text-[9px] capitalize", DIFFICULTY_COLORS[tech.difficulty])}>
                              {tech.difficulty}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] capitalize">{tech.platform}</Badge>
                            {tech.requiresPrivilege && (
                              <Badge variant="destructive" className="text-[9px]">Requires Privilege</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {tech.source} -- {tech.tokenType}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-4 pt-0">
                        {/* Steps */}
                        <div>
                          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                            Steps
                          </h3>
                          <ol className="space-y-1">
                            {tech.steps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                <span className="font-mono text-muted-foreground shrink-0 w-4 text-right">{i + 1}.</span>
                                <span className="text-muted-foreground">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Tools */}
                        <div>
                          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                            Tools
                          </h3>
                          <div className="flex flex-wrap gap-1">
                            {tech.tools.map((tool) => (
                              <Badge key={tool} variant="secondary" className="text-[10px] font-mono">{tool}</Badge>
                            ))}
                          </div>
                        </div>

                        {/* Paths */}
                        <div>
                          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                            File Paths / Locations
                          </h3>
                          <div className="space-y-0.5">
                            {tech.paths.map((path, i) => (
                              <div key={i} className="font-mono text-[10px] text-muted-foreground bg-black/20 rounded px-2 py-1">
                                {path}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Detection */}
                        <div>
                          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Detection Considerations
                          </h3>
                          <ul className="space-y-1">
                            {tech.detection.map((det, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                <span className="mt-1 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                                <span className="text-muted-foreground">{det}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Notes */}
                        {tech.notes && (
                          <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                            <Shield className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
                            <span className="text-[11px] text-amber-400/80">{tech.notes}</span>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          No extraction techniques match your search.
        </div>
      )}
    </div>
  )
}
