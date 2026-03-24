"use client"

import { useState, useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Activity,
  Search,
  ShieldAlert,
  AlertCircle,
  ChevronRight,
  FileText,
  FolderOpen,
} from "lucide-react"
import {
  useAuditDriveActivity,
  type DriveActivityEntry,
} from "@/hooks/use-audit-drive-activity"
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

type ActionFilter =
  | "all"
  | "create"
  | "edit"
  | "move"
  | "delete"
  | "permissionChange"
  | "comment"

const ACTION_FILTERS: { key: ActionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "move", label: "Move" },
  { key: "delete", label: "Delete" },
  { key: "permissionChange", label: "Share" },
  { key: "comment", label: "Comment" },
]

function formatTimestamp(ts: string | null): string {
  if (!ts) return "--"
  const date = new Date(ts)
  if (isNaN(date.getTime())) return "--"
  return formatDistanceToNow(date, { addSuffix: true })
}

function formatActors(entry: DriveActivityEntry): string {
  if (entry.actors.length === 0) return "Unknown"
  return entry.actors
    .map((a) => a.displayName || a.email || "Unknown")
    .join(", ")
}

function formatTargets(entry: DriveActivityEntry): string {
  if (entry.targets.length === 0) return "Unknown"
  return entry.targets.map((t) => t.title || t.name || "Unknown").join(", ")
}

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  edit: "Edited",
  move: "Moved",
  rename: "Renamed",
  delete: "Deleted",
  restore: "Restored",
  permissionChange: "Permission Change",
  comment: "Commented",
  dlpChange: "DLP Change",
  reference: "Referenced",
  settingsChange: "Settings Change",
  unknown: "Unknown",
}

function actionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] || actionType
}

function ActionBadge({ entry }: { entry: DriveActivityEntry }) {
  if (entry.isExternalShare) {
    return <Badge variant="destructive">External Share</Badge>
  }
  if (entry.isPermissionChange) {
    return (
      <Badge className="border-amber-500/30 bg-amber-950/20 text-amber-200">
        {actionLabel(entry.actionType)}
      </Badge>
    )
  }

  const variant =
    entry.actionType === "delete" ? "destructive" : "secondary"

  return <Badge variant={variant}>{actionLabel(entry.actionType)}</Badge>
}

export default function DriveActivityPage() {
  const [activeFilter, setActiveFilter] = useState<ActionFilter>("all")
  const [search, setSearch] = useState("")

  const { activities, nextPageToken, scope, loading, error, refetch, setPageToken } =
    useAuditDriveActivity()

  const filteredActivities = useMemo(() => {
    return activities.filter((entry) => {
      if (activeFilter !== "all" && entry.actionType !== activeFilter) {
        return false
      }
      if (search) {
        const q = search.toLowerCase()
        const searchable = [
          formatActors(entry),
          formatTargets(entry),
          entry.actionType,
        ]
          .join(" ")
          .toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
  }, [activities, activeFilter, search])

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activities.length }
    for (const entry of activities) {
      counts[entry.actionType] = (counts[entry.actionType] || 0) + 1
    }
    return counts
  }, [activities])

  const exportData = useMemo(
    () =>
      filteredActivities.map((e) => ({
        timestamp: e.timestamp || "",
        actors: formatActors(e),
        actionType: e.actionType,
        targets: formatTargets(e),
        isPermissionChange: e.isPermissionChange,
        isExternalShare: e.isExternalShare,
      })),
    [filteredActivities]
  )

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Unauthorized")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Drive Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track who accessed, modified, shared, or deleted files across Drive.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="drive-activity"
          disabled={loading || filteredActivities.length === 0}
        />
      </div>

      {/* Scope indicator */}
      {!loading && scope === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Scope denied -- the token does not have
            drive.activity.readonly access.
          </span>
        </div>
      )}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError
                  ? "Access denied"
                  : "Unable to load drive activity"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "The drive.activity.readonly scope is required to view file activity."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && activities.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {activities.length}
              </span>{" "}
              activities loaded
            </div>
          )}

          {/* Search and filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by actor, target, action..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {ACTION_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={activeFilter === f.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveFilter(f.key)}
                >
                  {f.label}
                  {!loading && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {filterCounts[f.key] || 0}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : activities.length === 0 && scope !== "denied" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Activity className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No activity found</p>
              <p className="text-sm text-muted-foreground">
                No recent file activity was detected in Drive.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No activities match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActivities.map((entry, idx) => (
                      <TableRow key={`${entry.timestamp}-${idx}`}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {formatActors(entry)}
                        </TableCell>
                        <TableCell>
                          <ActionBadge entry={entry} />
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="flex items-center gap-1.5 truncate">
                            {entry.targets[0]?.type === "teamDrive" ? (
                              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate">
                              {formatTargets(entry)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {entry.isExternalShare && (
                              <Badge variant="destructive" className="text-[10px]">
                                External Share
                              </Badge>
                            )}
                            {entry.isPermissionChange &&
                              !entry.isExternalShare && (
                                <Badge className="border-amber-500/30 bg-amber-950/20 text-amber-200 text-[10px]">
                                  Permission
                                </Badge>
                              )}
                            {entry.targets[0]?.mimeType && (
                              <span className="text-[10px] text-muted-foreground">
                                {simplifyMimeType(
                                  entry.targets[0].mimeType
                                )}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {nextPageToken && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageToken(nextPageToken)}
                  >
                    Load more
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function simplifyMimeType(mime: string): string {
  if (mime.includes("folder")) return "Folder"
  if (mime.includes("spreadsheet")) return "Sheet"
  if (mime.includes("document")) return "Doc"
  if (mime.includes("presentation")) return "Slides"
  if (mime.includes("pdf")) return "PDF"
  if (mime.includes("image")) return "Image"
  if (mime.includes("video")) return "Video"
  if (mime.includes("audio")) return "Audio"
  if (mime.includes("zip") || mime.includes("archive")) return "Archive"
  return mime.split("/").pop() || mime
}
