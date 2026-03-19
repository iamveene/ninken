"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StealthBadge } from "@/components/studio/stealth-badge"
import { GOOGLE_SERVICES } from "@/lib/studio/google-services"
import { MICROSOFT_SERVICES } from "@/lib/studio/microsoft-services"
import { getScopeDefinition } from "@/lib/studio/scope-definitions"
import { RiskBadge } from "@/components/studio/scope-tag"
import { ArrowRight } from "lucide-react"

interface ReverseAnalyzerProps {
  selectedScopes: string[]
}

export function ReverseAnalyzer({ selectedScopes }: ReverseAnalyzerProps) {
  const analysis = useMemo(() => {
    if (selectedScopes.length === 0) return { google: [], microsoft: [] }

    const googleUnlocked = GOOGLE_SERVICES.filter((svc) =>
      svc.scopes.some((s) => selectedScopes.includes(s))
    ).map((svc) => ({
      ...svc,
      matchedScopes: svc.scopes.filter((s) => selectedScopes.includes(s)),
      missingScopes: svc.scopes.filter((s) => !selectedScopes.includes(s)),
      fullyUnlocked: svc.scopes.every((s) => selectedScopes.includes(s)),
    }))

    const microsoftUnlocked = MICROSOFT_SERVICES.filter((svc) =>
      svc.scopes.some((s) => selectedScopes.includes(s))
    ).map((svc) => ({
      ...svc,
      matchedScopes: svc.scopes.filter((s) => selectedScopes.includes(s)),
      missingScopes: svc.scopes.filter((s) => !selectedScopes.includes(s)),
      fullyUnlocked: svc.scopes.every((s) => selectedScopes.includes(s)),
    }))

    return { google: googleUnlocked, microsoft: microsoftUnlocked }
  }, [selectedScopes])

  const totalUnlocked = analysis.google.length + analysis.microsoft.length

  if (selectedScopes.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          Select scopes above to see which services they unlock.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {totalUnlocked} service{totalUnlocked !== 1 ? "s" : ""} accessible with selected scopes
      </div>

      {analysis.google.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Google Services</h3>
          {analysis.google.map((svc) => (
            <ServiceUnlockCard key={svc.id} {...svc} />
          ))}
        </div>
      )}

      {analysis.microsoft.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Microsoft Services</h3>
          {analysis.microsoft.map((svc) => (
            <ServiceUnlockCard key={svc.id} {...svc} />
          ))}
        </div>
      )}
    </div>
  )
}

function ServiceUnlockCard({
  name,
  description,
  stealthLevel,
  matchedScopes,
  missingScopes,
  fullyUnlocked,
  endpoints,
}: {
  name: string
  description: string
  stealthLevel: number
  matchedScopes: string[]
  missingScopes: string[]
  fullyUnlocked: boolean
  endpoints: { method: string; description: string; useCase?: string }[]
}) {
  const useCaseEndpoints = endpoints.filter((e) => e.useCase)

  return (
    <Card className={fullyUnlocked ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50"}>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{name}</span>
          <StealthBadge level={stealthLevel as 1 | 2 | 3 | 4 | 5} size="sm" />
          {fullyUnlocked ? (
            <Badge variant="secondary" className="text-[9px] text-emerald-400 bg-emerald-500/10 ml-auto">
              Fully Unlocked
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] ml-auto">Partial</Badge>
          )}
        </div>

        {/* Matched scopes */}
        <div className="flex flex-wrap gap-1">
          {matchedScopes.map((s) => {
            const def = getScopeDefinition(s)
            return (
              <span key={s} className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 rounded px-1 py-0.5">
                {s.replace("https://www.googleapis.com/auth/", "")}
              </span>
            )
          })}
        </div>

        {/* Missing scopes */}
        {missingScopes.length > 0 && (
          <div>
            <span className="text-[9px] text-muted-foreground">Missing: </span>
            {missingScopes.map((s) => (
              <span key={s} className="text-[9px] font-mono text-red-400/60 mr-1">
                {s.replace("https://www.googleapis.com/auth/", "")}
              </span>
            ))}
          </div>
        )}

        {/* Key use cases */}
        {useCaseEndpoints.length > 0 && (
          <div className="space-y-0.5">
            {useCaseEndpoints.slice(0, 3).map((ep, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ArrowRight className="h-2 w-2 shrink-0" />
                <span>{ep.useCase}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
