"use client"

import { useState, useMemo } from "react"
import { Search, LogIn, AlertCircle, ShieldAlert } from "lucide-react"
import { useSignInLogs } from "@/hooks/use-m365-audit"
import type { SignInRecord } from "@/hooks/use-m365-audit"
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

type FilterKey = "all" | "failed" | "risky" | "ca-pass"

function riskBadge(level: string | undefined) {
  if (!level || level === "none" || level === "hidden") return null
  const color =
    level === "high"
      ? "destructive"
      : level === "medium"
        ? "secondary"
        : "outline"
  return <Badge variant={color}>{level}</Badge>
}

function statusLabel(record: SignInRecord) {
  const code = record.status?.errorCode
  if (code === 0 || code === undefined) return { text: "Success", failed: false }
  return {
    text: record.status?.failureReason || `Error ${code}`,
    failed: true,
  }
}

function locationString(record: SignInRecord) {
  const loc = record.location
  if (!loc) return "--"
  const parts = [loc.city, loc.state, loc.countryOrRegion].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "--"
}

function matchesFilter(record: SignInRecord, filter: FilterKey): boolean {
  switch (filter) {
    case "failed":
      return (record.status?.errorCode ?? 0) !== 0
    case "risky":
      return (
        !!record.riskLevelAggregated &&
        record.riskLevelAggregated !== "none" &&
        record.riskLevelAggregated !== "hidden"
      )
    case "ca-pass":
      return record.conditionalAccessStatus === "success"
    default:
      return true
  }
}

function matchesSearch(record: SignInRecord, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    record.userDisplayName?.toLowerCase().includes(q) ||
    record.userPrincipalName?.toLowerCase().includes(q) ||
    record.appDisplayName?.toLowerCase().includes(q) ||
    record.ipAddress?.toLowerCase().includes(q) ||
    false
  )
}

export default function SignInLogsPage() {
  const { signIns, loading, error } = useSignInLogs()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const stats = useMemo(() => {
    const total = signIns.length
    const failed = signIns.filter((r) => (r.status?.errorCode ?? 0) !== 0).length
    const risky = signIns.filter(
      (r) =>
        r.riskLevelAggregated &&
        r.riskLevelAggregated !== "none" &&
        r.riskLevelAggregated !== "hidden"
    ).length
    const caPass = signIns.filter((r) => r.conditionalAccessStatus === "success").length
    return { total, failed, risky, caPass }
  }, [signIns])

  const filtered = useMemo(
    () =>
      signIns.filter(
        (r) => matchesFilter(r, activeFilter) && matchesSearch(r, search)
      ),
    [signIns, activeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "failed", label: "Failed", count: stats.failed },
    { key: "risky", label: "Risky", count: stats.risky },
    { key: "ca-pass", label: "CA Pass", count: stats.caPass },
  ]

  const exportData = filtered.map((r) => ({
    user: r.userDisplayName,
    upn: r.userPrincipalName,
    app: r.appDisplayName,
    ip: r.ipAddress,
    location: locationString(r),
    status: statusLabel(r).text,
    riskLevel: r.riskLevelAggregated || "none",
    device: r.deviceDetail?.operatingSystem || "--",
    browser: r.deviceDetail?.browser || "--",
    timestamp: r.createdDateTime,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sign-In Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review recent sign-in activity, detect failed attempts, and identify risky authentication events.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-sign-in-logs"
          disabled={loading || filtered.length === 0}
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load sign-in logs"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "AuditLog.Read.All permission is required to access sign-in logs."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && signIns.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Total Sign-Ins</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className={`text-2xl font-bold ${stats.failed > 0 ? "text-destructive" : ""}`}>
                    {stats.failed}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">Risky</p>
                  <p className={`text-2xl font-bold ${stats.risky > 0 ? "text-destructive" : ""}`}>
                    {stats.risky}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">CA Pass</p>
                  <p className="text-2xl font-bold">{stats.caPass}</p>
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
                placeholder="Search by user, app, or IP..."
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
          ) : signIns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <LogIn className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No sign-in logs found</p>
              <p className="text-sm text-muted-foreground">
                No sign-in activity was returned from the audit log.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No sign-ins match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((record) => {
                      const st = statusLabel(record)
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="font-medium">{record.userDisplayName}</div>
                            <div className="text-xs text-muted-foreground">
                              {record.userPrincipalName}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.appDisplayName || "--"}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {record.ipAddress || "--"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {locationString(record)}
                          </TableCell>
                          <TableCell>
                            {st.failed ? (
                              <Badge variant="destructive">{st.text}</Badge>
                            ) : (
                              <span className="text-muted-foreground">{st.text}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div>{record.deviceDetail?.operatingSystem || "--"}</div>
                            <div className="text-xs">{record.deviceDetail?.browser || ""}</div>
                          </TableCell>
                          <TableCell>
                            {riskBadge(record.riskLevelAggregated) || (
                              <span className="text-muted-foreground/50">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {record.createdDateTime
                              ? formatDistanceToNow(new Date(record.createdDateTime), {
                                  addSuffix: true,
                                })
                              : "--"}
                          </TableCell>
                        </TableRow>
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
