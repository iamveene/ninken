"use client"

import { useAwsIamPolicies } from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Shield, AlertTriangle, FileText } from "lucide-react"

export default function AwsAuditIamPoliciesPage() {
  const { policies, loading, error, refetch } = useAwsIamPolicies()

  // Flag policies with high attachment counts (more blast radius)
  const highRiskPolicies = policies.filter((p) => p.attachmentCount >= 5)
  const mediumRiskPolicies = policies.filter((p) => p.attachmentCount >= 2 && p.attachmentCount < 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            IAM Policy Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customer-managed policy analysis
          </p>
        </div>
        <ExportButton
          data={policies as unknown as Record<string, unknown>[]}
          filename="aws-audit-iam-policies"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{highRiskPolicies.length}</p>
            <p className="text-[10px] text-muted-foreground">High Blast Radius (5+ attachments)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{mediumRiskPolicies.length}</p>
            <p className="text-[10px] text-muted-foreground">Medium Blast Radius (2-4)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{policies.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Policies</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Note: Full wildcard detection requires GetPolicyVersion access
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-[10px] text-muted-foreground">
            This view shows policy metadata. To detect wildcard (*) actions and resources,
            the IAM principal needs iam:GetPolicyVersion permissions to read policy documents.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Policy Name</TableHead>
              <TableHead className="text-xs text-right">Attachments</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Updated</TableHead>
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
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                  No customer-managed policies found
                </TableCell>
              </TableRow>
            ) : (
              policies
                .sort((a, b) => b.attachmentCount - a.attachmentCount)
                .map((policy) => (
                  <TableRow key={policy.policyId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{policy.policyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-[9px]">{policy.attachmentCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {policy.attachmentCount >= 5 ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">High</Badge>
                      ) : policy.attachmentCount >= 2 ? (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">Medium</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">Low</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                      {policy.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(policy.updateDate).toLocaleDateString()}
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
