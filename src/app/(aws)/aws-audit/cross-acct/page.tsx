"use client"

import { useMemo } from "react"
import { useAwsIamRoles, useAwsIdentity } from "@/hooks/use-aws"
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
import { Share2, AlertTriangle, Shield, Globe } from "lucide-react"

type CrossAccountTrust = {
  roleName: string
  roleArn: string
  trustedAccount: string
  trustedPrincipal: string
  isWildcard: boolean
  isExternal: boolean
}

export default function AwsAuditCrossAccountPage() {
  const { identity } = useAwsIdentity()
  const { roles, loading, error, refetch } = useAwsIamRoles()

  const crossAccountTrusts = useMemo(() => {
    const trusts: CrossAccountTrust[] = []
    const myAccount = identity?.accountId

    for (const role of roles) {
      if (!role.assumeRolePolicyDocument) continue
      try {
        const policy = JSON.parse(role.assumeRolePolicyDocument)
        const statements = policy.Statement ?? []

        for (const stmt of statements) {
          if (stmt.Effect !== "Allow") continue
          const principal = stmt.Principal
          if (!principal) continue

          // Check for wildcard
          if (principal === "*" || principal.AWS === "*") {
            trusts.push({
              roleName: role.roleName,
              roleArn: role.arn,
              trustedAccount: "*",
              trustedPrincipal: "*",
              isWildcard: true,
              isExternal: true,
            })
            continue
          }

          const awsPrincipals: string[] = Array.isArray(principal.AWS)
            ? principal.AWS
            : principal.AWS
              ? [principal.AWS]
              : []

          for (const arn of awsPrincipals) {
            if (typeof arn !== "string") continue
            const accountMatch = arn.match(/(\d{12})/)
            const accountId = accountMatch ? accountMatch[1] : null
            const isExternal = accountId !== null && accountId !== myAccount

            if (isExternal || !accountId) {
              trusts.push({
                roleName: role.roleName,
                roleArn: role.arn,
                trustedAccount: accountId ?? "unknown",
                trustedPrincipal: arn,
                isWildcard: false,
                isExternal: true,
              })
            }
          }

          // Check for federated principals
          const federated = principal.Federated
          if (federated) {
            const fedList = Array.isArray(federated) ? federated : [federated]
            for (const fed of fedList) {
              trusts.push({
                roleName: role.roleName,
                roleArn: role.arn,
                trustedAccount: "Federated",
                trustedPrincipal: fed,
                isWildcard: false,
                isExternal: true,
              })
            }
          }

          // Check for service principals
          const service = principal.Service
          if (service) {
            const svcList = Array.isArray(service) ? service : [service]
            for (const svc of svcList) {
              trusts.push({
                roleName: role.roleName,
                roleArn: role.arn,
                trustedAccount: "Service",
                trustedPrincipal: svc,
                isWildcard: false,
                isExternal: false,
              })
            }
          }
        }
      } catch {
        // Malformed policy
      }
    }

    return trusts
  }, [roles, identity?.accountId])

  const externalTrusts = crossAccountTrusts.filter((t) => t.isExternal)
  const wildcardTrusts = crossAccountTrusts.filter((t) => t.isWildcard)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Cross-Account Role Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Role trust relationship analysis for account {identity?.accountId ?? "..."}
          </p>
        </div>
        <ExportButton
          data={crossAccountTrusts as unknown as Record<string, unknown>[]}
          filename="aws-audit-cross-account"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{crossAccountTrusts.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Trust Relations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{externalTrusts.length}</p>
            <p className="text-[10px] text-muted-foreground">External Trusts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{wildcardTrusts.length}</p>
            <p className="text-[10px] text-muted-foreground">Wildcard Trusts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{roles.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Roles</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Trusted Account</TableHead>
              <TableHead className="text-xs">Trusted Principal</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : crossAccountTrusts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No cross-account trust relationships found
                </TableCell>
              </TableRow>
            ) : (
              crossAccountTrusts.map((trust, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">{trust.roleName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono">{trust.trustedAccount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-[250px] block">
                      {trust.trustedPrincipal}
                    </span>
                  </TableCell>
                  <TableCell>
                    {trust.isWildcard ? (
                      <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> WILDCARD
                      </Badge>
                    ) : trust.isExternal ? (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                        <Globe className="h-2.5 w-2.5 mr-0.5" /> External
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                        Internal
                      </Badge>
                    )}
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
