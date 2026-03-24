"use client"

import { useState, useMemo } from "react"
import { Search, Shield, ShieldAlert, AlertCircle, Key, Database } from "lucide-react"
import { useAuditAccessPolicies } from "@/hooks/use-audit-access-policies"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

export default function AccessPoliciesAuditPage() {
  const { delegations, securitySettings, schemas, scope, loading, error } = useAuditAccessPolicies()
  const [search, setSearch] = useState("")

  const filteredDelegations = useMemo(() => {
    if (!search) return delegations
    const q = search.toLowerCase()
    return delegations.filter(
      (d) =>
        d.assignedTo.toLowerCase().includes(q) ||
        d.roleName.toLowerCase().includes(q) ||
        d.scopeType.toLowerCase().includes(q)
    )
  }, [delegations, search])

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Unauthorized")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Access Policies Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review role assignments, security settings, and custom schemas across the workspace.
        </p>
      </div>

      {/* Scope indicator */}
      {!loading && scope === "limited" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Limited view -- admin privileges required for full access policy audit.</span>
        </div>
      )}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError ? "Access denied" : "Unable to load access policy data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions are required to audit access policies."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Security overview card */}
          {securitySettings.sampleSize != null && securitySettings.sampleSize > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Security Overview</h2>
                  <span className="text-[11px] text-muted-foreground">(sample of {securitySettings.sampleSize} users)</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-2xl font-bold">{securitySettings.twoFactorEnrollmentRate ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">2FA Enrollment</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{securitySettings.twoFactorEnforcementRate ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">2FA Enforcement</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{securitySettings.twoFactorEnrolled ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Enrolled Users</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{securitySettings.twoFactorEnforced ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Enforced Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role assignments */}
          {delegations.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Role Assignments</h2>
                <span className="text-xs text-muted-foreground">{delegations.length} total</span>
              </div>

              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by user, role, or scope..."
                  className="pl-9"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Scope Type</TableHead>
                    <TableHead>OU Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDelegations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <p className="text-muted-foreground">No assignments match the search.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDelegations.map((d) => (
                      <TableRow key={d.assignmentId}>
                        <TableCell className="font-medium font-mono text-xs">
                          {d.assignedTo}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{d.roleName || d.roleId}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={d.scopeType === "CUSTOMER" ? "destructive" : "outline"}
                          >
                            {d.scopeType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {d.orgUnitId || <span className="text-muted-foreground/50">--</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}

          {/* Custom schemas */}
          {schemas.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-4">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Custom Schemas</h2>
                <span className="text-xs text-muted-foreground">{schemas.length} schemas</span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schema Name</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Field Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemas.map((s) => (
                    <TableRow key={s.schemaId}>
                      <TableCell className="font-medium">{s.schemaName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.displayName || <span className="text-muted-foreground/50">--</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.fieldCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {s.fields.slice(0, 4).map((f) => (
                            <Badge key={f.fieldName} variant="outline" className="text-[10px]">
                              {f.fieldName} ({f.fieldType})
                            </Badge>
                          ))}
                          {s.fields.length > 4 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{s.fields.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {/* Empty state if nothing is available */}
          {delegations.length === 0 && schemas.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Shield className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No access policy data found</p>
              <p className="text-sm text-muted-foreground">
                No role assignments or schemas are available.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
