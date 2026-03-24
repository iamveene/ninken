"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScopeTag, RiskBadge } from "@/components/studio/scope-tag"
import { getScopesByPlatform, analyzeScopes, type ScopeDefinition } from "@/lib/studio/scope-definitions"
import { Search, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScopeSelectorProps {
  platform: "google" | "microsoft" | "all"
  selectedScopes: string[]
  onToggleScope: (scope: string) => void
}

export function ScopeSelector({ platform, selectedScopes, onToggleScope }: ScopeSelectorProps) {
  const [search, setSearch] = useState("")

  const scopes = useMemo(() => {
    let all: ScopeDefinition[] = []
    if (platform === "all" || platform === "google") {
      all = [...all, ...getScopesByPlatform("google")]
    }
    if (platform === "all" || platform === "microsoft") {
      all = [...all, ...getScopesByPlatform("microsoft")]
    }
    return all
  }, [platform])

  const filtered = useMemo(() => {
    if (!search) return scopes
    const lower = search.toLowerCase()
    return scopes.filter(
      (s) =>
        s.scope.toLowerCase().includes(lower) ||
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.redTeamValue.toLowerCase().includes(lower)
    )
  }, [scopes, search])

  const analysis = useMemo(() => analyzeScopes(selectedScopes), [selectedScopes])

  return (
    <div className="space-y-4">
      {/* Summary */}
      {selectedScopes.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Scope Profile
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedScopes.length} scopes selected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {selectedScopes.map((s) => {
                const def = analysis.found.find((f) => f.scope === s)
                return (
                  <ScopeTag
                    key={s}
                    scope={s}
                    risk={def?.risk}
                    onClick={() => onToggleScope(s)}
                  />
                )
              })}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Max Risk:</span>
              <RiskBadge risk={analysis.maxRisk} />
              {analysis.hasWriteAccess && (
                <Badge variant="destructive" className="text-[10px]">Write Access</Badge>
              )}
              <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>C:{analysis.riskSummary.critical}</span>
                <span>H:{analysis.riskSummary.high}</span>
                <span>M:{analysis.riskSummary.medium}</span>
                <span>L:{analysis.riskSummary.low}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scopes..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Scope list */}
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {filtered.map((scope) => {
          const selected = selectedScopes.includes(scope.scope)
          return (
            <button
              key={scope.scope}
              className={cn(
                "w-full flex items-start gap-3 rounded border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/30 bg-black/10 hover:border-border/60"
              )}
              onClick={() => onToggleScope(scope.scope)}
            >
              <div className={cn(
                "mt-0.5 h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
                selected ? "border-primary bg-primary" : "border-muted-foreground/30"
              )}>
                {selected && <span className="text-[8px] text-primary-foreground font-bold">V</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{scope.name}</span>
                  <RiskBadge risk={scope.risk} />
                  {scope.writeAccess && (
                    <Badge variant="outline" className="text-[8px]">Write</Badge>
                  )}
                  <Badge variant="outline" className="text-[8px] ml-auto capitalize">{scope.platform}</Badge>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                  {scope.scope}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{scope.description}</div>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            No scopes match your search.
          </div>
        )}
      </div>
    </div>
  )
}
