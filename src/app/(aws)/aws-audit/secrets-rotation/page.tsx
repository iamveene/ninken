"use client"

import { useMemo } from "react"
import { useAwsSecrets } from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, KeyRound, AlertTriangle, CheckCircle2, XCircle, RotateCw } from "lucide-react"
import { analyzeSecretsRotation } from "@/lib/aws-audit"

const RISK_BADGE: Record<string, { border: string; text: string; label: string }> = {
  critical: { border: "border-red-500/30", text: "text-red-400", label: "Critical" },
  high: { border: "border-amber-500/30", text: "text-amber-400", label: "High" },
  medium: { border: "border-yellow-500/30", text: "text-yellow-400", label: "Medium" },
  low: { border: "border-emerald-500/30", text: "text-emerald-400", label: "OK" },
}

export default function AwsSecretsRotationPage() {
  const { secrets, loading, error, refetch } = useAwsSecrets()

  const findings = useMemo(() => {
    if (secrets.length === 0 && loading) return []
    return analyzeSecretsRotation(secrets)
  }, [secrets, loading])

  const criticalCount = findings.filter((f) => f.riskLevel === "critical").length
  const highCount = findings.filter((f) => f.riskLevel === "high").length
  const noRotation = findings.filter((f) => !f.rotationEnabled).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Secrets Rotation Compliance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rotation age compliance analysis ({">"}365d = critical, {">"}180d = high, {">"}90d = medium)
          </p>
        </div>
        <ExportButton
          data={findings as unknown as Record<string, unknown>[]}
          filename="aws-audit-secrets-rotation"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{findings.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Secrets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${criticalCount > 0 ? "text-red-400" : ""}`}>
              {criticalCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Critical ({">"}365d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${highCount > 0 ? "text-amber-400" : ""}`}>
              {highCount}
            </p>
            <p className="text-[10px] text-muted-foreground">High ({">"}180d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${noRotation > 0 ? "text-amber-400" : ""}`}>
              {noRotation}
            </p>
            <p className="text-[10px] text-muted-foreground">No Auto-Rotation</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Secret Name</TableHead>
              <TableHead className="text-xs">Rotation</TableHead>
              <TableHead className="text-xs text-right">Days Since Rotation</TableHead>
              <TableHead className="text-xs">Last Rotated</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : findings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                  No secrets found
                </TableCell>
              </TableRow>
            ) : (
              [...findings]
                .sort((a, b) => b.daysSinceRotation - a.daysSinceRotation)
                .map((finding) => {
                  const risk = RISK_BADGE[finding.riskLevel]
                  return (
                    <TableRow key={finding.arn}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{finding.secretName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {finding.rotationEnabled ? (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                            <RotateCw className="h-2.5 w-2.5 mr-0.5" /> Enabled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                            <XCircle className="h-2.5 w-2.5 mr-0.5" /> Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-mono ${
                          finding.daysSinceRotation > 365 ? "text-red-400 font-bold" :
                          finding.daysSinceRotation > 180 ? "text-amber-400" :
                          finding.daysSinceRotation > 90 ? "text-yellow-400" :
                          ""
                        }`}>
                          {finding.daysSinceRotation}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {finding.lastRotated ? new Date(finding.lastRotated).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>
                        {finding.riskLevel === "low" ? (
                          <Badge variant="outline" className={`text-[9px] ${risk.border} ${risk.text}`}>
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> {risk.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`text-[9px] ${risk.border} ${risk.text}`}>
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {risk.label}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
