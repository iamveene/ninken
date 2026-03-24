"use client"

import { useState, useMemo } from "react"
import { Search, Package, ShieldAlert, AlertCircle } from "lucide-react"
import { useAuditMarketplace } from "@/hooks/use-audit-marketplace"
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

type FilterKey = "all" | "highScope" | "native"

function isSensitiveScope(scope: string): boolean {
  const sensitivePatterns = [
    "admin",
    "gmail",
    "drive",
    "calendar",
    "contacts",
    "directory",
    "spreadsheets",
    "full",
    "readonly",
  ]
  const lower = scope.toLowerCase()
  return sensitivePatterns.some((p) => lower.includes(p))
}

export default function MarketplaceAuditPage() {
  const { apps, totalApps, scope, loading, error } = useAuditMarketplace()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const highScopeApps = useMemo(
    () => apps.filter((a) => a.scopes.some(isSensitiveScope)),
    [apps]
  )

  const nativeApps = useMemo(
    () => apps.filter((a) => a.nativeApp),
    [apps]
  )

  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      if (activeFilter === "highScope" && !a.scopes.some(isSensitiveScope)) return false
      if (activeFilter === "native" && !a.nativeApp) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          a.displayText.toLowerCase().includes(q) ||
          a.clientId.toLowerCase().includes(q) ||
          a.scopes.some((s) => s.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [apps, activeFilter, search])

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Unauthorized")

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalApps },
    { key: "highScope", label: "Sensitive Scopes", count: highScopeApps.length },
    { key: "native", label: "Native Apps", count: nativeApps.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Marketplace Apps Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review third-party OAuth applications and their granted scopes across the organization.
        </p>
      </div>

      {/* Scope indicator */}
      {!loading && scope === "limited" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Limited view -- admin privileges required for full marketplace audit.</span>
        </div>
      )}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError ? "Access denied" : "Unable to load marketplace data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions are required to audit marketplace apps."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && apps.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{totalApps}</span> connected apps,{" "}
              <span
                className={
                  highScopeApps.length > 0
                    ? "font-medium text-destructive"
                    : "font-medium text-foreground"
                }
              >
                {highScopeApps.length}
              </span>{" "}
              with sensitive scopes
            </div>
          )}

          {/* Search and filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, client ID, or scope..."
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
                    <span className="ml-1 text-xs text-muted-foreground">{f.count}</span>
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
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Package className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No marketplace apps found</p>
              <p className="text-sm text-muted-foreground">
                No third-party apps have been authorized by users.
              </p>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-muted-foreground">No apps match the current filters.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApps.map((app) => {
                      const hasSensitive = app.scopes.some(isSensitiveScope)
                      return (
                        <TableRow key={app.clientId}>
                          <TableCell className="font-medium">{app.displayText}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs max-w-[160px] truncate" title={app.clientId}>
                            {app.clientId}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger className="cursor-default">
                                <Badge variant="secondary">{app.userCount}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {app.sampleUsers.join(", ")}
                                {app.userCount > app.sampleUsers.length && ` and ${app.userCount - app.sampleUsers.length} more`}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[300px]">
                              {app.scopes.slice(0, 3).map((s) => {
                                const label = s.split("/").pop() || s
                                return (
                                  <Tooltip key={s}>
                                    <TooltipTrigger className="cursor-default">
                                      <Badge
                                        variant={isSensitiveScope(s) ? "destructive" : "outline"}
                                        className="text-[10px]"
                                      >
                                        {label.length > 24 ? label.slice(0, 23) + "\u2026" : label}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{s}</TooltipContent>
                                  </Tooltip>
                                )
                              })}
                              {app.scopes.length > 3 && (
                                <Tooltip>
                                  <TooltipTrigger className="cursor-default">
                                    <Badge variant="outline" className="text-[10px]">
                                      +{app.scopes.length - 3}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {app.scopes.slice(3).join("\n")}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {app.nativeApp ? (
                              <Badge variant="outline">Native</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Web</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </>
      )}
    </div>
  )
}
