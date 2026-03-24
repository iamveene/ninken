"use client"

import { ShieldOff, AlertTriangle, ShieldAlert } from "lucide-react"
import { useM365CaBypass } from "@/hooks/use-m365-ca-bypass"
import type { CaBypassFinding } from "@/lib/audit/ca-bypass-scoring"
import { RiskScoreBadge } from "@/components/audit/risk-score-badge"
import { CaBypassStatsCards } from "@/components/audit/ca-bypass-stats-cards"
import { RiskHeatmap } from "@/components/audit/risk-heatmap"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const SEVERITY_BADGE: Record<string, { border: string; text: string; label: string }> = {
  critical: { border: "border-red-500/30", text: "text-red-400", label: "Critical" },
  high: { border: "border-orange-500/30", text: "text-orange-400", label: "High" },
  medium: { border: "border-amber-500/30", text: "text-amber-400", label: "Medium" },
  low: { border: "border-emerald-500/30", text: "text-emerald-400", label: "Low" },
}

const OPSEC_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Ghost", color: "text-emerald-400" },
  2: { label: "Quiet", color: "text-green-400" },
  3: { label: "Moderate", color: "text-amber-400" },
  4: { label: "Noisy", color: "text-orange-400" },
  5: { label: "Loud", color: "text-red-400" },
}

export default function CaBypassPage() {
  const { assessment, loading, error, refetch } = useM365CaBypass(true)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">CA Bypass Analyzer</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Conditional Access policy gap analysis with bypass techniques and OPSEC ratings.
          </p>
        </div>
        {assessment && (
          <ExportButton
            data={assessment.findings as unknown as Record<string, unknown>[]}
            filename="m365-ca-bypass-analysis"
          />
        )}
      </div>

      {loading ? (
        // Loading skeleton — follow exact pattern from github risk dashboard
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-3">
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : error && !assessment ? (
        <ServiceError error={error} onRetry={refetch} />
      ) : assessment ? (
        <div className="flex flex-col gap-6">
          {/* Overall Score */}
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bypass Risk
            </h2>
            <RiskScoreBadge severity={assessment.severity} score={assessment.aggregateScore} />
          </div>

          {/* Stats Cards */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Policy Overview
            </h2>
            <CaBypassStatsCards stats={assessment.stats} />
          </div>

          {/* Risk Heatmap */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Bypass Categories
            </h2>
            <RiskHeatmap categories={assessment.categories} />
          </div>

          {/* Findings Table — the KEY differentiator */}
          {assessment.findings.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Bypass Techniques ({assessment.findings.length})
              </h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Severity</TableHead>
                      <TableHead>Finding</TableHead>
                      <TableHead>Bypass Technique</TableHead>
                      <TableHead className="w-[90px]">OPSEC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessment.findings.map((finding: CaBypassFinding) => {
                      const sev = SEVERITY_BADGE[finding.severity]
                      const opsec = OPSEC_LABELS[finding.opsecRating]
                      return (
                        <TableRow key={finding.id}>
                          <TableCell>
                            <Badge variant="outline" className={`${sev.border} ${sev.text} text-[10px]`}>
                              {sev.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{finding.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{finding.description}</p>
                              {finding.policyName && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5">Policy: {finding.policyName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground">{finding.bypassTechnique}</p>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${opsec.color}`}>
                              {finding.opsecRating}/5 {opsec.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Partial data warning */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Some data sources failed to load. Analysis may be partial.</span>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No policy data available</p>
            <p className="text-xs text-muted-foreground">
              Ensure a Microsoft 365 token with Policy.Read.All scope is active, then reload the page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
