"use client"

import { useState, useMemo } from "react"
import { Search, ShieldAlert, AlertCircle } from "lucide-react"
import { useRiskyUsers } from "@/hooks/use-m365-audit"
import type { RiskyUser } from "@/hooks/use-m365-audit"
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

type FilterKey = "all" | "high" | "medium" | "low" | "atRisk"

function riskLevelBadge(level: string | undefined) {
  if (!level || level === "none" || level === "hidden") {
    return <span className="text-muted-foreground/50">--</span>
  }
  const variant =
    level === "high"
      ? "destructive"
      : level === "medium"
        ? "secondary"
        : "outline"
  return <Badge variant={variant}>{level}</Badge>
}

function riskStateBadge(state: string | undefined) {
  if (!state || state === "none") {
    return <span className="text-muted-foreground/50">--</span>
  }
  switch (state) {
    case "atRisk":
      return <Badge variant="destructive">At Risk</Badge>
    case "confirmedCompromised":
      return <Badge variant="destructive">Compromised</Badge>
    case "remediated":
      return <Badge variant="secondary">Remediated</Badge>
    case "dismissed":
      return <Badge variant="outline">Dismissed</Badge>
    case "confirmedSafe":
      return <Badge variant="outline">Safe</Badge>
    default:
      return <span className="text-muted-foreground">{state}</span>
  }
}

function matchesFilter(user: RiskyUser, filter: FilterKey): boolean {
  switch (filter) {
    case "high":
      return user.riskLevel === "high"
    case "medium":
      return user.riskLevel === "medium"
    case "low":
      return user.riskLevel === "low"
    case "atRisk":
      return user.riskState === "atRisk" || user.riskState === "confirmedCompromised"
    default:
      return true
  }
}

function matchesSearch(user: RiskyUser, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    user.userDisplayName?.toLowerCase().includes(q) ||
    user.userPrincipalName?.toLowerCase().includes(q) ||
    false
  )
}

export default function RiskyUsersPage() {
  const { riskyUsers, loading, error } = useRiskyUsers()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const stats = useMemo(() => {
    const total = riskyUsers.length
    const high = riskyUsers.filter((u) => u.riskLevel === "high").length
    const medium = riskyUsers.filter((u) => u.riskLevel === "medium").length
    const low = riskyUsers.filter((u) => u.riskLevel === "low").length
    const atRisk = riskyUsers.filter(
      (u) => u.riskState === "atRisk" || u.riskState === "confirmedCompromised"
    ).length
    return { total, high, medium, low, atRisk }
  }, [riskyUsers])

  const filtered = useMemo(
    () =>
      riskyUsers.filter(
        (u) => matchesFilter(u, activeFilter) && matchesSearch(u, search)
      ),
    [riskyUsers, activeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "high", label: "High", count: stats.high },
    { key: "medium", label: "Medium", count: stats.medium },
    { key: "low", label: "Low", count: stats.low },
    { key: "atRisk", label: "At Risk", count: stats.atRisk },
  ]

  const exportData = filtered.map((u) => ({
    user: u.userDisplayName,
    upn: u.userPrincipalName,
    riskLevel: u.riskLevel,
    riskState: u.riskState,
    riskDetail: u.riskDetail,
    lastUpdated: u.riskLastUpdatedDateTime,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Risky Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identify users flagged by Identity Protection based on anomalous sign-in behavior or compromised credentials.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-risky-users"
          disabled={loading || filtered.length === 0}
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load risky users"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "IdentityRiskyUser.Read.All permission is required to access risky users."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && riskyUsers.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Total Risky</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">High Risk</p>
                  <p className={`text-2xl font-bold ${stats.high > 0 ? "text-destructive" : ""}`}>
                    {stats.high}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Medium Risk</p>
                  <p className="text-2xl font-bold">{stats.medium}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Low Risk</p>
                  <p className="text-2xl font-bold">{stats.low}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Active Risk</p>
                  <p className={`text-2xl font-bold ${stats.atRisk > 0 ? "text-destructive" : ""}`}>
                    {stats.atRisk}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {!loading && riskyUsers.length === 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="flex items-center gap-3 py-4">
                <ShieldAlert className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium">No risky users detected</p>
                  <p className="text-sm text-muted-foreground">
                    Identity Protection has not flagged any users in this tenant.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or UPN..."
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
          ) : riskyUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No risky users match the current filters.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.userDisplayName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.userPrincipalName}
                      </TableCell>
                      <TableCell>{riskLevelBadge(user.riskLevel)}</TableCell>
                      <TableCell>{riskStateBadge(user.riskState)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {user.riskDetail && user.riskDetail !== "none"
                          ? user.riskDetail
                          : "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {user.riskLastUpdatedDateTime
                          ? formatDistanceToNow(new Date(user.riskLastUpdatedDateTime), {
                              addSuffix: true,
                            })
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}
        </>
      )}
    </div>
  )
}
