"use client"

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
import { AlertTriangle, KeyRound, RotateCw, CheckCircle2, XCircle } from "lucide-react"

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const then = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
}

export default function AwsAuditSecretsPage() {
  const { secrets, loading, error, refetch } = useAwsSecrets()

  const noRotation = secrets.filter((s) => !s.rotationEnabled)
  const staleSecrets = secrets.filter((s) => {
    const age = daysSince(s.lastChangedDate)
    return age !== null && age > 90
  })
  const criticalSecrets = secrets.filter((s) => {
    const age = daysSince(s.lastChangedDate)
    return age !== null && age > 365
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Secrets Rotation Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secret age and rotation hygiene analysis
          </p>
        </div>
        <ExportButton
          data={secrets as unknown as Record<string, unknown>[]}
          filename="aws-audit-secrets"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{secrets.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Secrets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{noRotation.length}</p>
            <p className="text-[10px] text-muted-foreground">No Auto-Rotation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{staleSecrets.length}</p>
            <p className="text-[10px] text-muted-foreground">Stale ({">"}90 days)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{criticalSecrets.length}</p>
            <p className="text-[10px] text-muted-foreground">Critical ({">"}365 days)</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Secret Name</TableHead>
              <TableHead className="text-xs">Rotation</TableHead>
              <TableHead className="text-xs text-right">Age (days)</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
              <TableHead className="text-xs">Last Changed</TableHead>
              <TableHead className="text-xs">Last Rotated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : secrets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No secrets found
                </TableCell>
              </TableRow>
            ) : (
              secrets
                .sort((a, b) => {
                  const ageA = daysSince(a.lastChangedDate) ?? 0
                  const ageB = daysSince(b.lastChangedDate) ?? 0
                  return ageB - ageA
                })
                .map((secret) => {
                  const age = daysSince(secret.lastChangedDate)
                  return (
                    <TableRow key={secret.arn}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{secret.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {secret.rotationEnabled ? (
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
                          age !== null && age > 365 ? "text-red-400 font-bold" :
                          age !== null && age > 90 ? "text-amber-400" :
                          ""
                        }`}>
                          {age ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {age !== null && age > 365 ? (
                          <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Critical
                          </Badge>
                        ) : age !== null && age > 90 ? (
                          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                            Stale
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {secret.lastChangedDate ? new Date(secret.lastChangedDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {secret.lastRotatedDate ? new Date(secret.lastRotatedDate).toLocaleDateString() : "Never"}
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
