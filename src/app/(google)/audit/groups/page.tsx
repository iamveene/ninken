"use client"

import { Users, UsersRound, AlertCircle, Info } from "lucide-react"
import { useAuditGroups } from "@/hooks/use-audit"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function GroupsAuditPage() {
  const { data, loading, error } = useAuditGroups()
  const groups = data.groups
  const scope = data.scope

  const isPermissionError =
    error != null &&
    (error.includes("403") ||
      error.includes("Forbidden") ||
      error.includes("Unauthorized"))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Groups Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect group memberships, access settings, and external sharing
          configurations.
        </p>
      </div>

      {/* Scope indicator */}
      {!loading && !error && scope === "user" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <Info className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Limited view — showing groups you belong to. Full organization audit requires admin privileges.</span>
        </div>
      )}
      {!loading && !error && scope === "organization" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/10 px-3 py-2 text-sm text-emerald-200">
          <UsersRound className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Full organization view — showing all groups.</span>
        </div>
      )}
      {!loading && !error && scope === "none" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>Cannot list groups with current permissions.</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError
                  ? "Access denied"
                  : "Unable to load groups data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions are required to audit groups across the organization."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">No groups found</p>
          <p className="text-sm text-muted-foreground">
            No groups exist in the workspace yet.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {groups.length} {groups.length === 1 ? "group" : "groups"} total
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.email}
                  </TableCell>
                  <TableCell>{group.directMembersCount}</TableCell>
                  <TableCell
                    className="max-w-[300px] truncate text-muted-foreground"
                    title={group.description}
                  >
                    {group.description || (
                      <span className="text-muted-foreground/50">--</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
