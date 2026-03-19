"use client"

import { useState, useMemo } from "react"
import { Search, ShieldAlert, AlertCircle, ArrowLeft, Clock, Wifi } from "lucide-react"
import { useRiskyUsers, useRiskDetections } from "@/hooks/use-m365-audit"
import type { RiskyUser, RiskDetection, SignInLocation } from "@/hooks/use-m365-audit"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

function formatLocation(location: SignInLocation | undefined): string {
  if (!location) return "--"
  const parts = [location.city, location.state, location.countryOrRegion].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "--"
}

function formatRiskEventType(type: string): string {
  // Convert camelCase to readable format
  return type
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function matchesDetectionSearch(d: RiskDetection, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    d.userDisplayName?.toLowerCase().includes(q) ||
    d.userPrincipalName?.toLowerCase().includes(q) ||
    d.riskEventType?.toLowerCase().includes(q) ||
    d.ipAddress?.toLowerCase().includes(q) ||
    formatLocation(d.location).toLowerCase().includes(q) ||
    false
  )
}

// ---------------------------------------------------------------------------
// Risky Users Tab
// ---------------------------------------------------------------------------

function RiskyUsersTab({
  riskyUsers,
  loading,
  error,
  onInvestigateUser,
}: {
  riskyUsers: RiskyUser[]
  loading: boolean
  error: string | null
  onInvestigateUser: (userId: string, displayName: string) => void
}) {
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

  if (error) {
    return (
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
    )
  }

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-1">
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
        <ExportButton
          data={exportData}
          filename="m365-risky-users"
          disabled={loading || filtered.length === 0}
        />
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
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onInvestigateUser(user.id, user.userDisplayName)}
                >
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk Detections Tab
// ---------------------------------------------------------------------------

function RiskDetectionsTab({
  investigatingUserId,
  investigatingUserName,
  onClearInvestigation,
}: {
  investigatingUserId?: string
  investigatingUserName?: string
  onClearInvestigation: () => void
}) {
  const { riskDetections, loading, error } = useRiskDetections(investigatingUserId)
  const [search, setSearch] = useState("")

  const filtered = useMemo(
    () => riskDetections.filter((d) => matchesDetectionSearch(d, search)),
    [riskDetections, search]
  )

  const stats = useMemo(() => {
    const total = riskDetections.length
    const high = riskDetections.filter((d) => d.riskLevel === "high").length
    const medium = riskDetections.filter((d) => d.riskLevel === "medium").length
    const low = riskDetections.filter((d) => d.riskLevel === "low").length
    const realtime = riskDetections.filter((d) => d.detectionTimingType === "realtime").length
    const offline = riskDetections.filter((d) => d.detectionTimingType === "offline").length
    return { total, high, medium, low, realtime, offline }
  }, [riskDetections])

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const exportData = filtered.map((d) => ({
    time: d.activityDateTime,
    user: d.userDisplayName,
    upn: d.userPrincipalName,
    riskEventType: d.riskEventType,
    riskLevel: d.riskLevel,
    riskState: d.riskState,
    detectionTiming: d.detectionTimingType,
    ipAddress: d.ipAddress,
    location: formatLocation(d.location),
    activity: d.activity,
  }))

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {investigatingUserId && (
          <div>
            <Button variant="ghost" size="sm" onClick={onClearInvestigation}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to all detections
            </Button>
          </div>
        )}
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load risk detections"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "IdentityRiskEvent.Read.All permission is required to access risk detection details."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {investigatingUserId && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClearInvestigation}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to all detections
          </Button>
          <span className="text-sm text-muted-foreground">
            Investigating: <span className="font-medium text-foreground">{investigatingUserName || investigatingUserId}</span>
          </span>
        </div>
      )}

      {!loading && riskDetections.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Total Detections</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">High</p>
              <p className={`text-2xl font-bold ${stats.high > 0 ? "text-destructive" : ""}`}>
                {stats.high}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Medium</p>
              <p className={`text-2xl font-bold ${stats.medium > 0 ? "text-amber-500" : ""}`}>
                {stats.medium}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Low</p>
              <p className="text-2xl font-bold">{stats.low}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Realtime</p>
              </div>
              <p className="text-2xl font-bold">{stats.realtime}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Offline</p>
              </div>
              <p className="text-2xl font-bold">{stats.offline}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && riskDetections.length === 0 && !error && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <ShieldAlert className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium">No risk detections found</p>
              <p className="text-sm text-muted-foreground">
                {investigatingUserId
                  ? "No risk detection events found for this user."
                  : "Identity Protection has not logged any risk detection events in this tenant."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search detections by user, type, IP, location..."
            className="pl-9"
          />
        </div>
        <ExportButton
          data={exportData}
          filename={investigatingUserId ? `m365-risk-detections-${investigatingUserId}` : "m365-risk-detections"}
          disabled={loading || filtered.length === 0}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : riskDetections.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              {!investigatingUserId && <TableHead>User</TableHead>}
              <TableHead>Risk Type</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={investigatingUserId ? 6 : 7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    No risk detections match the current search.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((detection) => (
                <TableRow key={detection.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {detection.activityDateTime
                      ? formatDistanceToNow(new Date(detection.activityDateTime), {
                          addSuffix: true,
                        })
                      : "--"}
                  </TableCell>
                  {!investigatingUserId && (
                    <TableCell className="font-medium">
                      {detection.userDisplayName || detection.userPrincipalName || "--"}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="text-sm">{formatRiskEventType(detection.riskEventType)}</span>
                    {detection.detectionTimingType && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {detection.detectionTimingType}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{riskLevelBadge(detection.riskLevel)}</TableCell>
                  <TableCell>
                    {detection.ipAddress ? (
                      <code className="font-mono text-xs">{detection.ipAddress}</code>
                    ) : (
                      <span className="text-muted-foreground/50">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {formatLocation(detection.location)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {detection.activity || "--"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RiskyUsersPage() {
  const { riskyUsers, loading, error } = useRiskyUsers()
  const [activeTab, setActiveTab] = useState("users")
  const [investigatingUserId, setInvestigatingUserId] = useState<string | undefined>()
  const [investigatingUserName, setInvestigatingUserName] = useState<string | undefined>()

  function handleInvestigateUser(userId: string, displayName: string) {
    setInvestigatingUserId(userId)
    setInvestigatingUserName(displayName)
    setActiveTab("detections")
  }

  function handleClearInvestigation() {
    setInvestigatingUserId(undefined)
    setInvestigatingUserName(undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Identity Protection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Risky users and risk detection events from Microsoft Identity Protection.
        </p>
      </div>

      <Tabs
        defaultValue="users"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as string)}
      >
        <TabsList>
          <TabsTrigger value="users">Risky Users</TabsTrigger>
          <TabsTrigger value="detections">
            Risk Detections
            {investigatingUserId && (
              <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <RiskyUsersTab
            riskyUsers={riskyUsers}
            loading={loading}
            error={error}
            onInvestigateUser={handleInvestigateUser}
          />
        </TabsContent>

        <TabsContent value="detections">
          <RiskDetectionsTab
            investigatingUserId={investigatingUserId}
            investigatingUserName={investigatingUserName}
            onClearInvestigation={handleClearInvestigation}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
