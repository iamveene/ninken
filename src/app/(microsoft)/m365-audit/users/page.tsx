"use client"

import { useState, useMemo } from "react"
import { Search, Users, AlertCircle } from "lucide-react"
import { useEntraUsers } from "@/hooks/use-entra"
import type { EntraUser } from "@/hooks/use-entra"
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
import { formatDistanceToNow } from "date-fns"

type FilterKey = "all" | "disabled" | "external"

function matchesFilter(user: EntraUser, filter: FilterKey): boolean {
  switch (filter) {
    case "disabled":
      return !user.accountEnabled
    case "external":
      return user.userPrincipalName.includes("#EXT#")
    default:
      return true
  }
}

function matchesSearch(user: EntraUser, search: string): boolean {
  if (!search) return true
  const q = search.toLowerCase()
  return (
    user.displayName.toLowerCase().includes(q) ||
    user.userPrincipalName.toLowerCase().includes(q) ||
    (user.mail?.toLowerCase().includes(q) ?? false)
  )
}

export default function M365UsersAuditPage() {
  const { users, loading, error } = useEntraUsers()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const stats = useMemo(() => {
    const total = users.length
    const disabled = users.filter((u) => !u.accountEnabled).length
    const external = users.filter((u) => u.userPrincipalName.includes("#EXT#")).length
    return { total, disabled, external }
  }, [users])

  const filteredUsers = useMemo(
    () => users.filter((u) => matchesFilter(u, activeFilter) && matchesSearch(u, search)),
    [users, activeFilter, search]
  )

  const is403 = error?.includes("403") || error?.includes("Forbidden") || error?.includes("Authorization")

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "disabled", label: "Disabled", count: stats.disabled },
    { key: "external", label: "External", count: stats.external },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Users Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review all user accounts in the Microsoft 365 tenant, their status, and last sign-in activity.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">{is403 ? "Insufficient permissions" : "Unable to load user data"}</p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "User.Read.All or Directory.Read.All permission is required to enumerate users."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && users.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{stats.total}</span> users total,{" "}
              <span className={stats.disabled > 0 ? "font-medium text-destructive" : "font-medium text-foreground"}>
                {stats.disabled}
              </span>{" "}
              disabled,{" "}
              <span className="font-medium text-foreground">{stats.external}</span> external guests
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, UPN, or email..."
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
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm text-muted-foreground">No user accounts were returned from the directory.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>UPN / Email</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sign-In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">No users match the current filters.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.displayName}</TableCell>
                      <TableCell className="text-muted-foreground">{user.mail || user.userPrincipalName}</TableCell>
                      <TableCell className="text-muted-foreground">{user.jobTitle || <span className="text-muted-foreground/50">--</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{user.department || <span className="text-muted-foreground/50">--</span>}</TableCell>
                      <TableCell>
                        {user.accountEnabled ? (
                          <span className="text-muted-foreground">Active</span>
                        ) : (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastSignInDateTime
                          ? formatDistanceToNow(new Date(user.lastSignInDateTime), { addSuffix: true })
                          : "Unknown"}
                      </TableCell>
                    </TableRow>
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
