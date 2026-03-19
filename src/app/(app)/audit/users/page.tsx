"use client"

import { useState, useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import { Search, Users, ShieldAlert, AlertCircle } from "lucide-react"
import { useAuditUsers, type AuditUser } from "@/hooks/use-audit"
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

type FilterKey = "all" | "no2fa" | "admins" | "suspended"

function matchesFilter(user: AuditUser, filter: FilterKey): boolean {
  switch (filter) {
    case "no2fa":
      return !user.isEnrolledIn2Sv
    case "admins":
      return user.isAdmin || user.isDelegatedAdmin
    case "suspended":
      return user.suspended
    default:
      return true
  }
}

function matchesSearch(user: AuditUser, search: string): boolean {
  if (!search) return true
  const q = search.toLowerCase()
  return (
    user.primaryEmail.toLowerCase().includes(q) ||
    user.fullName.toLowerCase().includes(q)
  )
}

function formatLastLogin(lastLoginTime: string | null): string {
  if (!lastLoginTime) return "Never"
  const date = new Date(lastLoginTime)
  // Google returns "1970-01-01T00:00:00.000Z" for users who have never logged in
  if (date.getTime() === 0) return "Never"
  return formatDistanceToNow(date, { addSuffix: true })
}

function truncateOuPath(path: string, maxLen = 28): string {
  if (path.length <= maxLen) return path
  return path.slice(0, maxLen - 1) + "\u2026"
}

export default function UsersAuditPage() {
  const { data, loading, error } = useAuditUsers()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const users = data.users
  const scope = data.scope

  const stats = useMemo(() => {
    const total = users.length
    const without2fa = users.filter((u) => !u.isEnrolledIn2Sv).length
    const admins = users.filter((u) => u.isAdmin || u.isDelegatedAdmin).length
    const suspended = users.filter((u) => u.suspended).length
    return { total, without2fa, admins, suspended }
  }, [users])

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) => matchesFilter(u, activeFilter) && matchesSearch(u, search)
      ),
    [users, activeFilter, search]
  )

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorized")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "no2fa", label: "No 2FA", count: stats.without2fa },
    { key: "admins", label: "Admins", count: stats.admins },
    { key: "suspended", label: "Suspended", count: stats.suspended },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Users Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review all user accounts, their status, last sign-in activity, and
          admin privileges.
        </p>
      </div>

      {/* Scope indicator */}
      {!loading && scope === "self" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Limited view — showing your own account only. Organization-wide user audit requires admin privileges.</span>
        </div>
      )}
      {!loading && scope === "organization" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/10 px-3 py-2 text-sm text-emerald-200">
          <Users className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Full organization view — showing all users.</span>
        </div>
      )}

      {/* Error state */}
      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403
                  ? "Admin permissions required"
                  : "Unable to load user data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "Admin permissions required to view user audit data."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          {!loading && users.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {stats.total}
              </span>{" "}
              users total,{" "}
              <span
                className={
                  stats.without2fa > 0
                    ? "font-medium text-destructive"
                    : "font-medium text-foreground"
                }
              >
                {stats.without2fa}
              </span>{" "}
              without 2FA,{" "}
              <span className="font-medium text-foreground">
                {stats.admins}
              </span>{" "}
              admins
            </div>
          )}

          {/* Search bar and filter buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name..."
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
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm text-muted-foreground">
                No user accounts were returned from the directory.
              </p>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>2FA Status</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>OU Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No users match the current filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.primaryEmail}>
                        <TableCell className="font-medium">
                          {user.primaryEmail}
                        </TableCell>
                        <TableCell>{user.fullName}</TableCell>
                        <TableCell>
                          {user.isEnrolledIn2Sv ? (
                            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">
                              Enrolled
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Not Enrolled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Badge variant="destructive">
                              <ShieldAlert className="mr-0.5 h-3 w-3" />
                              Super Admin
                            </Badge>
                          ) : user.isDelegatedAdmin ? (
                            <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/20">
                              Delegated
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {user.suspended ? (
                            <Badge variant="destructive">Suspended</Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatLastLogin(user.lastLoginTime)}
                        </TableCell>
                        <TableCell>
                          {user.orgUnitPath.length > 28 ? (
                            <Tooltip>
                              <TooltipTrigger className="cursor-default text-muted-foreground">
                                {truncateOuPath(user.orgUnitPath)}
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.orgUnitPath}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">
                              {user.orgUnitPath}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
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
