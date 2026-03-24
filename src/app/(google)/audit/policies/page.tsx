"use client"

import { useState, useMemo } from "react"
import { Search, FolderTree, Globe, ShieldAlert, AlertCircle } from "lucide-react"
import { useAuditPolicies } from "@/hooks/use-audit-policies"
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

export default function PoliciesAuditPage() {
  const { orgUnits, domains, scope, loading, error } = useAuditPolicies()
  const [search, setSearch] = useState("")

  const filteredOrgUnits = useMemo(() => {
    if (!search) return orgUnits
    const q = search.toLowerCase()
    return orgUnits.filter(
      (ou) =>
        ou.name.toLowerCase().includes(q) ||
        ou.orgUnitPath.toLowerCase().includes(q) ||
        ou.description.toLowerCase().includes(q)
    )
  }, [orgUnits, search])

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Unauthorized")

  const inheritanceBlockCount = orgUnits.filter((ou) => ou.blockInheritance).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Policies Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review organizational units, domain configuration, and policy inheritance.
        </p>
      </div>

      {/* Scope indicator */}
      {!loading && scope === "limited" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Limited view -- admin privileges required for full policy audit.</span>
        </div>
      )}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError ? "Access denied" : "Unable to load policy data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions are required to audit policies across the organization."
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
          {/* Domains section */}
          {domains.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Domains</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {domains.map((d) => (
                    <Badge
                      key={d.domainName}
                      variant={d.isPrimary ? "default" : "secondary"}
                      className="gap-1"
                    >
                      {d.domainName}
                      {d.isPrimary && (
                        <span className="text-[10px] opacity-70">primary</span>
                      )}
                      {!d.verified && (
                        <span className="text-[10px] text-destructive">unverified</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          {orgUnits.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{orgUnits.length}</span> organizational units
              {inheritanceBlockCount > 0 && (
                <>
                  , <span className="font-medium text-destructive">{inheritanceBlockCount}</span> with blocked inheritance
                </>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizational units..."
              className="pl-9"
            />
          </div>

          {/* OU Table */}
          {orgUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <FolderTree className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No organizational units found</p>
              <p className="text-sm text-muted-foreground">
                No OUs are configured in the workspace.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Parent Path</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Inheritance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No OUs match the search.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgUnits.map((ou) => (
                    <TableRow key={ou.orgUnitId}>
                      <TableCell className="font-medium">{ou.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {ou.orgUnitPath}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {ou.parentOrgUnitPath || "/"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={ou.description}>
                        {ou.description || <span className="text-muted-foreground/50">--</span>}
                      </TableCell>
                      <TableCell>
                        {ou.blockInheritance ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Inherited</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
