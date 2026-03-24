"use client"

import { useMemo } from "react"
import { useAwsIamUsers, useAwsIamRoles, useAwsIamPolicies } from "@/hooks/use-aws"
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
import { TrendingUp, AlertTriangle, ShieldAlert } from "lucide-react"
import { analyzePrivEsc } from "@/lib/aws-audit"

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "border-red-500/30 text-red-400 bg-red-500/5"
    case "high": return "border-orange-500/30 text-orange-400 bg-orange-500/5"
    case "medium": return "border-amber-500/30 text-amber-400 bg-amber-500/5"
    case "low": return "border-blue-500/30 text-blue-400 bg-blue-500/5"
    default: return ""
  }
}

export default function AwsAuditPrivEscPage() {
  const { users, loading: usersLoading, error: usersError, refetch: refetchUsers } = useAwsIamUsers()
  const { roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useAwsIamRoles()
  const { policies, loading: policiesLoading, error: policiesError, refetch: refetchPolicies } = useAwsIamPolicies()

  const loading = usersLoading || rolesLoading || policiesLoading
  const error = usersError || rolesError || policiesError

  const findings = useMemo(() => {
    if (loading) return []
    return analyzePrivEsc(users, roles, policies)
  }, [users, roles, policies, loading])

  const criticalCount = findings.filter((f) => f.severity === "critical").length
  const highCount = findings.filter((f) => f.severity === "high").length
  const mediumCount = findings.filter((f) => f.severity === "medium").length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Privilege Escalation Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            IAM privilege escalation path detection
          </p>
        </div>
        <ExportButton
          data={findings as unknown as Record<string, unknown>[]}
          filename="aws-audit-privesc"
        />
      </div>

      {error && <ServiceError error={error} onRetry={() => { refetchUsers(); refetchRoles(); refetchPolicies() }} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
            <p className="text-[10px] text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{highCount}</p>
            <p className="text-[10px] text-muted-foreground">High</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{mediumCount}</p>
            <p className="text-[10px] text-muted-foreground">Medium</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{findings.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Findings</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Severity</TableHead>
              <TableHead className="text-xs">Technique</TableHead>
              <TableHead className="text-xs">Principal</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
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
                  No privilege escalation findings detected
                </TableCell>
              </TableRow>
            ) : (
              findings.map((finding, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] ${severityColor(finding.severity)}`}>
                      {finding.severity === "critical" ? (
                        <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                      ) : (
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      )}
                      {finding.severity.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono">{finding.technique}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{finding.principal}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground line-clamp-2">{finding.description}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {finding.affectedActions.slice(0, 3).map((action) => (
                        <Badge key={action} variant="secondary" className="text-[8px] font-mono px-1 py-0">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
