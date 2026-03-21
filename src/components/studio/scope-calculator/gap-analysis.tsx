"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RiskBadge, ScopeTag } from "@/components/studio/scope-tag"
import { GOOGLE_SERVICES } from "@/lib/studio/google-services"
import { MICROSOFT_SERVICES } from "@/lib/studio/microsoft-services"
import { getScopeDefinition } from "@/lib/studio/scope-definitions"
import { Target, Zap } from "lucide-react"

interface GapAnalysisProps {
  selectedScopes: string[]
}

interface GapItem {
  scope: string
  name: string
  servicesUnlocked: string[]
  risk: "low" | "medium" | "high" | "critical"
  impact: string
}

export function GapAnalysis({ selectedScopes }: GapAnalysisProps) {
  const gaps = useMemo(() => {
    if (selectedScopes.length === 0) return []

    const allServices = [
      ...GOOGLE_SERVICES.map((s) => ({ ...s, platform: "google" as const })),
      ...MICROSOFT_SERVICES.map((s) => ({ ...s, platform: "microsoft" as const })),
    ]

    // Find services that are partially unlocked
    const partialServices = allServices.filter((svc) => {
      const hasAny = svc.scopes.some((s) => selectedScopes.includes(s))
      const hasAll = svc.scopes.every((s) => selectedScopes.includes(s))
      return hasAny && !hasAll
    })

    // Find missing scopes that would complete access
    const missingMap = new Map<string, { scope: string; services: string[] }>()

    for (const svc of partialServices) {
      for (const scope of svc.scopes) {
        if (!selectedScopes.includes(scope)) {
          const existing = missingMap.get(scope)
          if (existing) {
            existing.services.push(svc.name)
          } else {
            missingMap.set(scope, { scope, services: [svc.name] })
          }
        }
      }
    }

    // Convert to gap items
    const items: GapItem[] = []
    for (const [scope, { services }] of missingMap) {
      const def = getScopeDefinition(scope)
      items.push({
        scope,
        name: def?.name ?? scope,
        servicesUnlocked: services,
        risk: def?.risk ?? "medium",
        impact: def?.redTeamValue ?? "Additional service access",
      })
    }

    // Sort by number of services unlocked (most impactful first)
    return items.sort((a, b) => b.servicesUnlocked.length - a.servicesUnlocked.length)
  }, [selectedScopes])

  if (selectedScopes.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          Select scopes to see gap analysis recommendations.
        </CardContent>
      </Card>
    )
  }

  if (gaps.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-4 text-center text-xs text-emerald-400">
          No scope gaps detected. All partially-accessible services are fully unlocked.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-muted-foreground" />
          Scope Gap Analysis
        </CardTitle>
        <CardDescription className="text-xs">
          {gaps.length} additional scope{gaps.length !== 1 ? "s" : ""} would expand access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {gaps.map((gap) => (
            <div
              key={gap.scope}
              className="flex items-start gap-3 rounded border border-border/30 bg-black/10 px-3 py-2"
            >
              <Zap className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{gap.name}</span>
                  <RiskBadge risk={gap.risk} />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">
                  {gap.scope}
                </div>
                <div className="text-[10px] text-muted-foreground">{gap.impact}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">Unlocks:</span>
                  {gap.servicesUnlocked.map((s) => (
                    <Badge key={s} variant="outline" className="text-[8px]">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
