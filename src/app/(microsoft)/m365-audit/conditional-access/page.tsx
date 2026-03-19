"use client"

import { useState, useMemo } from "react"
import { Search, ShieldCheck, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { useConditionalAccessPolicies } from "@/hooks/use-m365-audit"
import type { ConditionalAccessPolicy } from "@/hooks/use-m365-audit"
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
import { formatDistanceToNow } from "date-fns"

type FilterKey = "all" | "enabled" | "disabled" | "reportOnly"

function stateBadge(state: string) {
  switch (state) {
    case "enabled":
      return <Badge variant="default">Enabled</Badge>
    case "disabled":
      return <Badge variant="outline">Disabled</Badge>
    case "enabledForReportingButNotEnforced":
      return <Badge variant="secondary">Report Only</Badge>
    default:
      return <span className="text-muted-foreground">{state}</span>
  }
}

function summarizeConditions(conditions: Record<string, unknown> | undefined): string {
  if (!conditions) return "--"
  const parts: string[] = []

  const users = conditions.users as Record<string, unknown> | undefined
  if (users) {
    const includeUsers = users.includeUsers as string[] | undefined
    const includeGroups = users.includeGroups as string[] | undefined
    if (includeUsers?.includes("All")) {
      parts.push("All users")
    } else if (includeUsers?.length || includeGroups?.length) {
      const count = (includeUsers?.length ?? 0) + (includeGroups?.length ?? 0)
      parts.push(`${count} user/group target${count > 1 ? "s" : ""}`)
    }
  }

  const apps = conditions.applications as Record<string, unknown> | undefined
  if (apps) {
    const includeApps = apps.includeApplications as string[] | undefined
    if (includeApps?.includes("All")) {
      parts.push("All apps")
    } else if (includeApps?.length) {
      parts.push(`${includeApps.length} app${includeApps.length > 1 ? "s" : ""}`)
    }
  }

  const platforms = conditions.platforms as Record<string, unknown> | undefined
  if (platforms) {
    const includePlatforms = platforms.includePlatforms as string[] | undefined
    if (includePlatforms?.includes("all")) {
      parts.push("All platforms")
    } else if (includePlatforms?.length) {
      parts.push(includePlatforms.join(", "))
    }
  }

  const locations = conditions.locations as Record<string, unknown> | undefined
  if (locations) {
    const includeLocations = locations.includeLocations as string[] | undefined
    if (includeLocations?.includes("All")) {
      parts.push("All locations")
    } else if (includeLocations?.length) {
      parts.push(`${includeLocations.length} location${includeLocations.length > 1 ? "s" : ""}`)
    }
  }

  return parts.length > 0 ? parts.join("; ") : "--"
}

function summarizeGrantControls(
  controls: ConditionalAccessPolicy["grantControls"]
): string {
  if (!controls) return "--"
  const builtIn = controls.builtInControls ?? []
  if (builtIn.length === 0) return "--"
  const op = controls.operator ?? "OR"
  return builtIn.join(` ${op} `)
}

function matchesFilter(policy: ConditionalAccessPolicy, filter: FilterKey): boolean {
  switch (filter) {
    case "enabled":
      return policy.state === "enabled"
    case "disabled":
      return policy.state === "disabled"
    case "reportOnly":
      return policy.state === "enabledForReportingButNotEnforced"
    default:
      return true
  }
}

function matchesSearch(policy: ConditionalAccessPolicy, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return policy.displayName?.toLowerCase().includes(q) || false
}

export default function ConditionalAccessPage() {
  const { policies, loading, error } = useConditionalAccessPolicies()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const stats = useMemo(() => {
    const total = policies.length
    const enabled = policies.filter((p) => p.state === "enabled").length
    const disabled = policies.filter((p) => p.state === "disabled").length
    const reportOnly = policies.filter(
      (p) => p.state === "enabledForReportingButNotEnforced"
    ).length
    return { total, enabled, disabled, reportOnly }
  }, [policies])

  const filtered = useMemo(
    () =>
      policies.filter(
        (p) => matchesFilter(p, activeFilter) && matchesSearch(p, search)
      ),
    [policies, activeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "enabled", label: "Enabled", count: stats.enabled },
    { key: "disabled", label: "Disabled", count: stats.disabled },
    { key: "reportOnly", label: "Report Only", count: stats.reportOnly },
  ]

  const exportData = filtered.map((p) => ({
    name: p.displayName,
    state: p.state,
    conditions: summarizeConditions(p.conditions),
    grantControls: summarizeGrantControls(p.grantControls),
    created: p.createdDateTime,
    modified: p.modifiedDateTime,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Conditional Access Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review conditional access policies configured in the tenant, their state, conditions, and grant controls.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-conditional-access"
          disabled={loading || filtered.length === 0}
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load conditional access policies"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "Policy.Read.All permission is required to access conditional access policies."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && policies.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Total Policies</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Enabled</p>
                  <p className="text-2xl font-bold">{stats.enabled}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Disabled</p>
                  <p className="text-2xl font-bold">{stats.disabled}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Report Only</p>
                  <p className="text-2xl font-bold">{stats.reportOnly}</p>
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
                placeholder="Search by policy name..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
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
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No conditional access policies found</p>
              <p className="text-sm text-muted-foreground">
                No conditional access policies are configured in this tenant.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Policy Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Grant Controls</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No policies match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((policy) => {
                      const isExpanded = expandedIds.has(policy.id)
                      return (
                        <>
                          <TableRow
                            key={policy.id}
                            className="cursor-pointer"
                            onClick={() => toggleExpanded(policy.id)}
                          >
                            <TableCell className="px-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{policy.displayName}</TableCell>
                            <TableCell>{stateBadge(policy.state)}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[250px] truncate">
                              {summarizeConditions(policy.conditions)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {summarizeGrantControls(policy.grantControls)}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {policy.createdDateTime
                                ? formatDistanceToNow(new Date(policy.createdDateTime), {
                                    addSuffix: true,
                                  })
                                : "--"}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {policy.modifiedDateTime
                                ? formatDistanceToNow(new Date(policy.modifiedDateTime), {
                                    addSuffix: true,
                                  })
                                : "--"}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${policy.id}-expanded`}>
                              <TableCell colSpan={7} className="bg-muted/30 px-6 py-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <div>
                                    <h4 className="text-sm font-medium mb-2">Conditions (raw)</h4>
                                    <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-60">
                                      {JSON.stringify(policy.conditions, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Grant Controls (raw)</h4>
                                      <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-40">
                                        {JSON.stringify(policy.grantControls, null, 2)}
                                      </pre>
                                    </div>
                                    {policy.sessionControls && (
                                      <div>
                                        <h4 className="text-sm font-medium mb-2">Session Controls (raw)</h4>
                                        <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-40">
                                          {JSON.stringify(policy.sessionControls, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
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
