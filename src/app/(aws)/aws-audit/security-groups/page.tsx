"use client"

import { useMemo } from "react"
import { useAwsSecurityGroups } from "@/hooks/use-aws"
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
import { Network, AlertTriangle, Shield } from "lucide-react"
import { analyzeSecurityGroups } from "@/lib/aws-audit"

const RISK_BADGE: Record<string, { border: string; text: string; label: string }> = {
  critical: { border: "border-red-500/30", text: "text-red-400", label: "Critical" },
  high: { border: "border-amber-500/30", text: "text-amber-400", label: "High" },
  medium: { border: "border-yellow-500/30", text: "text-yellow-400", label: "Medium" },
}

export default function AwsSecurityGroupsPage() {
  const { securityGroups, loading, error, refetch } = useAwsSecurityGroups()

  const findings = useMemo(() => {
    if (securityGroups.length === 0 && loading) return []
    return analyzeSecurityGroups(securityGroups)
  }, [securityGroups, loading])

  const criticalCount = findings.filter((f) => f.riskLevel === "critical").length
  const highCount = findings.filter((f) => f.riskLevel === "high").length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Network className="h-5 w-5" />
            Security Group Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound rules open to the internet (0.0.0.0/0)
          </p>
        </div>
        <ExportButton
          data={findings as unknown as Record<string, unknown>[]}
          filename="aws-audit-security-groups"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{securityGroups.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Security Groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{findings.length}</p>
            <p className="text-[10px] text-muted-foreground">Open Findings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${criticalCount > 0 ? "text-red-400" : ""}`}>
              {criticalCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${highCount > 0 ? "text-amber-400" : ""}`}>
              {highCount}
            </p>
            <p className="text-[10px] text-muted-foreground">High</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Security Group</TableHead>
              <TableHead className="text-xs">VPC</TableHead>
              <TableHead className="text-xs">Port</TableHead>
              <TableHead className="text-xs">Protocol</TableHead>
              <TableHead className="text-xs">Source</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
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
            ) : findings.length === 0 ? (
              securityGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                    No security groups found
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                    No open-to-world findings across {securityGroups.length} security groups
                  </TableCell>
                </TableRow>
              )
            ) : (
              findings.map((finding, i) => {
                const risk = RISK_BADGE[finding.riskLevel]
                return (
                  <TableRow key={`${finding.groupId}-${finding.port}-${i}`}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{finding.groupName}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono ml-5">
                          {finding.groupId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {finding.vpcId || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[9px] font-mono">
                        {finding.port}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {finding.protocol}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                        {finding.sourceRange}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${risk.border} ${risk.text}`}>
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {risk.label}
                      </Badge>
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
