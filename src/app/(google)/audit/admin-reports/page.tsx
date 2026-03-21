"use client"

import { useState, useMemo } from "react"
import { formatDistanceToNow, subHours, format } from "date-fns"
import {
  Search,
  FileText,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import {
  useAuditAdminReports,
  type ApplicationName,
  type ReportActivity,
} from "@/hooks/use-audit-admin-reports"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceError } from "@/components/ui/service-error"
import { ExportButton } from "@/components/layout/export-button"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

type TabDef = { key: ApplicationName; label: string }

const APPLICATION_TABS: TabDef[] = [
  { key: "login", label: "Login" },
  { key: "admin", label: "Admin" },
  { key: "token", label: "Token" },
  { key: "drive", label: "Drive" },
  { key: "mobile", label: "Mobile" },
]

function formatActivityTime(time: string): string {
  if (!time) return "--"
  const date = new Date(time)
  if (isNaN(date.getTime())) return "--"
  return formatDistanceToNow(date, { addSuffix: true })
}

function getEventBadgeVariant(
  eventType: string
): "default" | "secondary" | "outline" | "destructive" {
  const lower = eventType.toLowerCase()
  if (lower.includes("warning") || lower.includes("suspicious")) return "destructive"
  if (lower.includes("admin") || lower.includes("change")) return "default"
  return "secondary"
}

function ExpandableRow({ activity }: { activity: ReportActivity }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {activity.parameters.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          {formatActivityTime(activity.time)}
        </TableCell>
        <TableCell className="font-medium text-sm">{activity.actor}</TableCell>
        <TableCell className="text-muted-foreground font-mono text-xs">
          {activity.ipAddress || "--"}
        </TableCell>
        <TableCell>
          <Badge variant={getEventBadgeVariant(activity.eventType)} className="text-xs">
            {activity.eventType || "--"}
          </Badge>
        </TableCell>
        <TableCell className="font-medium text-sm">{activity.eventName || "--"}</TableCell>
      </TableRow>
      {expanded && activity.parameters.length > 0 && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6} className="py-3 px-6">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs max-w-2xl">
              {activity.parameters.map((p, i) => (
                <div key={i} className="contents">
                  <span className="font-medium text-muted-foreground">{p.name}</span>
                  <span className="text-foreground font-mono break-all">{p.value || "--"}</span>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<ApplicationName>("login")
  const [search, setSearch] = useState("")
  const [userFilter, setUserFilter] = useState("")

  // Default time range: last 24 hours
  const [startTime] = useState(() => subHours(new Date(), 24).toISOString())
  const [endTime] = useState(() => new Date().toISOString())

  const { activities, scope, loading, error, refetch } = useAuditAdminReports(
    activeTab,
    {
      userKey: userFilter || "all",
      startTime,
      endTime,
    }
  )

  const filteredActivities = useMemo(() => {
    if (!search) return activities
    const q = search.toLowerCase()
    return activities.filter((a) => {
      const searchable = [
        a.actor,
        a.ipAddress,
        a.eventType,
        a.eventName,
        ...a.parameters.map((p) => `${p.name} ${p.value}`),
      ]
        .join(" ")
        .toLowerCase()
      return searchable.includes(q)
    })
  }, [activities, search])

  const exportData = useMemo(
    () =>
      filteredActivities.map((a) => ({
        time: a.time,
        actor: a.actor,
        ipAddress: a.ipAddress,
        eventType: a.eventType,
        eventName: a.eventName,
        applicationName: a.applicationName,
        parameters: a.parameters.map((p) => `${p.name}=${p.value}`).join("; "),
      })),
    [filteredActivities]
  )

  const timeRangeLabel = `${format(new Date(startTime), "MMM d, HH:mm")} - ${format(new Date(endTime), "MMM d, HH:mm")}`

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Admin Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit logs for user activity, sign-in events, admin actions, OAuth token grants, and file
          operations.
        </p>
      </div>

      {/* OPSEC warning */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span>
          Accessing this page generates log entries visible to SOC. Every query to the Reports API
          is itself an auditable event.
        </span>
      </div>

      {/* Scope denied banner */}
      {!loading && scope === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Admin privileges required for Reports API access. The current token lacks the necessary
            admin.reports.audit.readonly scope or admin role.
          </span>
        </div>
      )}

      {error ? (
        <ServiceError error={error} onRetry={refetch} />
      ) : (
        <>
          {/* Application tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {APPLICATION_TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-2 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events, actors, IPs..."
                  className="pl-9"
                />
              </div>
              <Input
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="User email (default: all)"
                className="max-w-[220px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{timeRangeLabel}</span>
              <Button variant="ghost" size="sm" onClick={refetch}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <ExportButton
                data={exportData}
                filename={`admin-reports-${activeTab}`}
                disabled={filteredActivities.length === 0}
              />
            </div>
          </div>

          {/* Summary */}
          {!loading && activities.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{activities.length}</span> activities
              {filteredActivities.length !== activities.length && (
                <span>
                  {" "}
                  (<span className="font-medium text-foreground">{filteredActivities.length}</span>{" "}
                  matching filter)
                </span>
              )}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No activities found</p>
              <p className="text-sm text-muted-foreground">
                {scope === "denied"
                  ? "Admin Reports API access is denied for the current token."
                  : `No ${activeTab} events in the selected time range.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Event</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No activities match the current search.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivities.map((activity, idx) => (
                    <ExpandableRow key={activity.id || idx} activity={activity} />
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
