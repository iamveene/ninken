"use client"

import { useState, useMemo } from "react"
import { Settings2, Search, AlertCircle, ShieldAlert } from "lucide-react"
import {
  useAuditGroupsSettings,
  type RiskLevel,
} from "@/hooks/use-audit-groups-settings"
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

type FilterKey = "all" | "critical" | "high" | "medium" | "low"

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "text-red-400",
  high: "text-amber-400",
  medium: "text-yellow-400",
  low: "text-muted-foreground",
}

const RISK_BADGE_VARIANT: Record<RiskLevel, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
}

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge variant={RISK_BADGE_VARIANT[level]} className="capitalize">
      {level}
    </Badge>
  )
}

export default function GroupsSettingsAuditPage() {
  const { groups, scope, skippedCount, loading, error } = useAuditGroupsSettings()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const g of groups) {
      counts[g.riskLevel]++
    }
    return counts
  }, [groups])

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (activeFilter !== "all" && g.riskLevel !== activeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          g.name.toLowerCase().includes(q) ||
          g.email.toLowerCase().includes(q) ||
          g.riskFactors.some((f) => f.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [groups, activeFilter, search])

  const exportData = useMemo(
    () =>
      filteredGroups.map((g) => ({
        name: g.name,
        email: g.email,
        riskLevel: g.riskLevel,
        riskFactors: g.riskFactors.join("; "),
        whoCanJoin: g.whoCanJoin,
        whoCanPostMessage: g.whoCanPostMessage,
        whoCanViewMembership: g.whoCanViewMembership,
        allowExternalMembers: g.allowExternalMembers,
        allowWebPosting: g.allowWebPosting,
        isArchived: g.isArchived,
        membersCanPostAsTheGroup: g.membersCanPostAsTheGroup,
        messageModerationLevel: g.messageModerationLevel,
      })),
    [filteredGroups]
  )

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Unauthorized")

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: groups.length },
    { key: "critical", label: "Critical", count: riskCounts.critical },
    { key: "high", label: "High", count: riskCounts.high },
    { key: "medium", label: "Medium", count: riskCounts.medium },
    { key: "low", label: "Low", count: riskCounts.low },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Groups Settings Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze security-relevant group configurations — external members, posting
            permissions, join policies, and moderation settings.
          </p>
        </div>
        {!loading && groups.length > 0 && (
          <ExportButton
            data={exportData}
            filename="groups-settings-audit"
            columns={[
              "name",
              "email",
              "riskLevel",
              "riskFactors",
              "whoCanJoin",
              "whoCanPostMessage",
              "allowExternalMembers",
              "messageModerationLevel",
            ]}
          />
        )}
      </div>

      {/* Scope indicators */}
      {!loading && !error && scope === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>
            Cannot list groups with current permissions. Admin Directory and Groups
            Settings API access is required.
          </span>
        </div>
      )}
      {!loading && !error && skippedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            {skippedCount} group{skippedCount === 1 ? "" : "s"} skipped due to
            permission errors. Results are partial.
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
                  : "Unable to load groups settings"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions and Groups Settings API scope are required."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Risk summary cards */}
          {!loading && groups.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["critical", "high", "medium", "low"] as const).map((level) => (
                <Card key={level}>
                  <CardContent className="py-3">
                    <p className={`text-2xl font-bold ${RISK_COLORS[level]}`}>
                      {riskCounts[level]}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{level}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Search and filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or risk factor..."
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
                  {!loading && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {f.count}
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
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Settings2 className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No groups found</p>
              <p className="text-sm text-muted-foreground">
                No groups are available for settings analysis.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>External Members</TableHead>
                  <TableHead>Join Policy</TableHead>
                  <TableHead>Post Policy</TableHead>
                  <TableHead>Risk Factors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No groups match the current filters.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => {
                    const isExternal = group.allowExternalMembers === "true"
                    return (
                      <TableRow
                        key={group.email}
                        className={
                          isExternal ? "border-l-2 border-l-red-500" : ""
                        }
                      >
                        <TableCell className="font-medium">
                          {group.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono max-w-[200px] truncate">
                          {group.email}
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={group.riskLevel} />
                        </TableCell>
                        <TableCell>
                          {isExternal ? (
                            <Badge variant="destructive">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              No
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="text-[10px]">
                            {group.whoCanJoin}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="text-[10px]">
                            {group.whoCanPostMessage}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {group.riskFactors.length === 0 ? (
                              <span className="text-muted-foreground/50 text-sm">
                                --
                              </span>
                            ) : (
                              group.riskFactors.map((factor) => (
                                <Badge
                                  key={factor}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {factor}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
