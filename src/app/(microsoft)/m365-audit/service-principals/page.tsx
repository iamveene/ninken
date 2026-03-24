"use client"

import { useState, useMemo, Fragment } from "react"
import {
  Search,
  AppWindow,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Shield,
  Key,
} from "lucide-react"
import { useServicePrincipals } from "@/hooks/use-m365-audit"
import type { ServicePrincipalAuditEntry } from "@/hooks/use-m365-audit"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
import { ExportButton } from "@/components/layout/export-button"

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterKey = "all" | "withPermissions" | "application" | "managedIdentity" | "disabled"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBadge(spType: string) {
  switch (spType) {
    case "Application":
      return <Badge variant="secondary">Application</Badge>
    case "ManagedIdentity":
      return <Badge variant="outline">Managed Identity</Badge>
    case "Legacy":
      return <Badge variant="destructive">Legacy</Badge>
    case "SocialIdp":
      return <Badge variant="outline">Social IdP</Badge>
    default:
      return <Badge variant="outline">{spType}</Badge>
  }
}

function permissionCount(sp: ServicePrincipalAuditEntry) {
  return sp.appRoleAssignments.length + sp.delegatedPermissions.length
}

function matchesFilter(sp: ServicePrincipalAuditEntry, filter: FilterKey): boolean {
  switch (filter) {
    case "withPermissions":
      return permissionCount(sp) > 0
    case "application":
      return sp.servicePrincipalType === "Application"
    case "managedIdentity":
      return sp.servicePrincipalType === "ManagedIdentity"
    case "disabled":
      return !sp.accountEnabled
    default:
      return true
  }
}

function matchesSearch(sp: ServicePrincipalAuditEntry, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    sp.displayName?.toLowerCase().includes(q) ||
    sp.appId?.toLowerCase().includes(q) ||
    sp.servicePrincipalType?.toLowerCase().includes(q) ||
    sp.appRoleAssignments.some((r) => r.resourceDisplayName?.toLowerCase().includes(q)) ||
    sp.delegatedPermissions.some((d) => d.scope?.toLowerCase().includes(q)) ||
    false
  )
}

// ---------------------------------------------------------------------------
// Expandable permission row
// ---------------------------------------------------------------------------

function PermissionDetails({ sp }: { sp: ServicePrincipalAuditEntry }) {
  const hasApp = sp.appRoleAssignments.length > 0
  const hasDelegated = sp.delegatedPermissions.length > 0

  if (!hasApp && !hasDelegated) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        No permissions assigned to this service principal.
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {hasApp && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Application Permissions ({sp.appRoleAssignments.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sp.appRoleAssignments.map((ra) => (
              <Badge key={ra.id} variant="secondary" className="text-xs">
                {ra.resourceDisplayName} / {ra.appRoleId.substring(0, 8)}...
              </Badge>
            ))}
          </div>
        </div>
      )}
      {hasDelegated && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Delegated Permissions ({sp.delegatedPermissions.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sp.delegatedPermissions.map((dp, i) => (
              <Badge key={`${dp.scope}-${i}`} variant="outline" className="text-xs">
                {dp.scope}
                {dp.consentType === "AllPrincipals" && (
                  <span className="ml-1 text-destructive font-semibold" title="Admin consent (all principals)">*</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ServicePrincipalsPage() {
  const { servicePrincipals, loading, error } = useServicePrincipals()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const stats = useMemo(() => {
    const total = servicePrincipals.length
    const withPermissions = servicePrincipals.filter((sp) => permissionCount(sp) > 0).length
    const application = servicePrincipals.filter((sp) => sp.servicePrincipalType === "Application").length
    const managedIdentity = servicePrincipals.filter((sp) => sp.servicePrincipalType === "ManagedIdentity").length
    const disabled = servicePrincipals.filter((sp) => !sp.accountEnabled).length
    return { total, withPermissions, application, managedIdentity, disabled }
  }, [servicePrincipals])

  const filtered = useMemo(
    () =>
      servicePrincipals.filter(
        (sp) => matchesFilter(sp, activeFilter) && matchesSearch(sp, search)
      ),
    [servicePrincipals, activeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "withPermissions", label: "With Permissions", count: stats.withPermissions },
    { key: "application", label: "Application", count: stats.application },
    { key: "managedIdentity", label: "Managed Identity", count: stats.managedIdentity },
    { key: "disabled", label: "Disabled", count: stats.disabled },
  ]

  const exportData = filtered.map((sp) => ({
    displayName: sp.displayName,
    appId: sp.appId,
    type: sp.servicePrincipalType,
    enabled: sp.accountEnabled,
    appRoleAssignments: sp.appRoleAssignments.length,
    delegatedPermissions: sp.delegatedPermissions.length,
    delegatedScopes: sp.delegatedPermissions.map((d) => d.scope).join(", "),
    adminConsentScopes: sp.delegatedPermissions
      .filter((d) => d.consentType === "AllPrincipals")
      .map((d) => d.scope)
      .join(", "),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Service Principals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enumerate service principals, their permissions (delegated and application), and identify over-privileged apps.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-service-principals"
          disabled={loading || filtered.length === 0}
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load service principals"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "Application.Read.All or Directory.Read.All permission is required to access service principals."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && servicePrincipals.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">With Permissions</p>
                  <p className="text-2xl font-bold">{stats.withPermissions}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Applications</p>
                  <p className="text-2xl font-bold">{stats.application}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Disabled</p>
                  <p className={`text-2xl font-bold ${stats.disabled > 0 ? "text-amber-500" : ""}`}>
                    {stats.disabled}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, app ID, or permission..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  variant={activeFilter === f.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveFilter(f.key)}
                >
                  {f.label}
                  {!loading && f.count !== undefined && (
                    <span className="ml-1 text-xs text-muted-foreground">{f.count}</span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : servicePrincipals.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <AppWindow className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No service principals found</p>
              <p className="text-sm text-muted-foreground">
                No service principals were returned from Microsoft Graph.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Display Name</TableHead>
                    <TableHead>App ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">App Roles</TableHead>
                    <TableHead className="text-right">Delegated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No service principals match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((sp) => {
                      const isExpanded = expandedIds.has(sp.id)
                      const totalPerms = permissionCount(sp)
                      return (
                        <Fragment key={sp.id}>
                          <TableRow
                            className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? "bg-muted/30" : ""}`}
                            onClick={() => toggleExpanded(sp.id)}
                          >
                            <TableCell className="w-8 px-2">
                              {totalPerms > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )
                              ) : (
                                <span className="inline-block w-4" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{sp.displayName || "--"}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {sp.appId}
                            </TableCell>
                            <TableCell>{typeBadge(sp.servicePrincipalType)}</TableCell>
                            <TableCell>
                              {sp.accountEnabled ? (
                                <span className="text-muted-foreground">Enabled</span>
                              ) : (
                                <Badge variant="destructive">Disabled</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {sp.appRoleAssignments.length > 0 ? (
                                <Badge variant="secondary">{sp.appRoleAssignments.length}</Badge>
                              ) : (
                                <span className="text-muted-foreground/50">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {sp.delegatedPermissions.length > 0 ? (
                                <span>
                                  <Badge variant="outline">{sp.delegatedPermissions.length}</Badge>
                                  {sp.delegatedPermissions.some((d) => d.consentType === "AllPrincipals") && (
                                    <span className="ml-1 text-destructive text-xs font-semibold" title="Includes admin consent">*</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">0</span>
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={7} className="p-0 border-b">
                                <PermissionDetails sp={sp} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
