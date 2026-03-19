"use client"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StealthBadge } from "@/components/studio/stealth-badge"
import { ScopeTag } from "@/components/studio/scope-tag"
import { ClaimsTable } from "./claims-table"
import { CapabilitiesPanel } from "./capabilities-panel"
import { ExpiryCountdown } from "./expiry-countdown"
import type { JwtAnalysis } from "@/lib/studio/jwt-decoder"
import type { TokenTypeDefinition } from "@/lib/studio/token-types"
import { analyzeScopes } from "@/lib/studio/scope-definitions"
import { AlertTriangle, Shield, Clock, Fingerprint } from "lucide-react"

interface AnalyzerResultsProps {
  analysis: JwtAnalysis | null
  tokenType: TokenTypeDefinition | null
  rawToken: string
}

export function AnalyzerResults({ analysis, tokenType, rawToken }: AnalyzerResultsProps) {
  if (!analysis && !tokenType) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span>Could not identify this token format. Verify the token is complete and properly formatted.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const scopeAnalysis = analysis?.scopes ? analyzeScopes(analysis.scopes) : null

  return (
    <div className="space-y-4">
      {/* Token Identity */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
            Token Identification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {tokenType && (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</div>
                  <div className="font-medium">{tokenType.name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</div>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {tokenType.format}
                  </Badge>
                </div>
              </>
            )}
            {analysis && (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Platform</div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{analysis.platform}</Badge>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Token Type</div>
                  <Badge variant="outline" className="text-[10px] capitalize">{analysis.tokenType}</Badge>
                </div>
              </>
            )}
            {tokenType?.defaultLifetime && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Default Lifetime</div>
                <div className="font-mono text-xs">{Math.floor(tokenType.defaultLifetime / 60)}m</div>
              </div>
            )}
          </div>

          {tokenType?.description && (
            <p className="text-xs text-muted-foreground">{tokenType.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Expiry */}
      {analysis?.expiry.expiresAt && (
        <ExpiryCountdown expiry={analysis.expiry} />
      )}

      {/* Observations */}
      {analysis?.observations && analysis.observations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Security Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {analysis.observations.map((obs, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                  <span className="text-muted-foreground">{obs}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Scopes */}
      {scopeAnalysis && scopeAnalysis.found.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Scopes ({analysis?.scopes.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Max risk: <span className="font-mono uppercase">{scopeAnalysis.maxRisk}</span>
              {scopeAnalysis.hasWriteAccess && " | Write access enabled"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {scopeAnalysis.found.map((s) => (
                <ScopeTag key={s.scope} scope={s.scope} risk={s.risk} />
              ))}
              {scopeAnalysis.unknown.map((s) => (
                <ScopeTag key={s} scope={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claims Table */}
      {analysis && <ClaimsTable claims={analysis.claims} />}

      {/* Capabilities */}
      {analysis && <CapabilitiesPanel scopes={analysis.scopes} platform={analysis.platform} />}

      {/* OPSEC Notes */}
      {tokenType?.opsecNotes && tokenType.opsecNotes.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">OPSEC Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {tokenType.opsecNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
