"use client"

import { Users, AlertCircle } from "lucide-react"
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

  const isPermissionError =
    error != null &&
    (error.includes("403") ||
      error.includes("Forbidden") ||
      error.includes("Authorized"))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Groups Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect group memberships, access settings, and external sharing
          configurations.
        </p>
      </div>

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
