"use client"

import { ShieldCheck, AlertCircle } from "lucide-react"
import { useAuditRoles } from "@/hooks/use-audit"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function RolesAuditPage() {
  const { data, loading, error } = useAuditRoles()
  const roles = data.roles

  const isPermissionError =
    error != null &&
    (error.includes("403") ||
      error.includes("Forbidden") ||
      error.includes("Unauthorized"))

  const rolesWithAssignees = roles.filter((r) => r.assignees.length > 0).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Roles Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review admin roles, custom role definitions, and privilege assignments
          across the workspace.
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
                  : "Unable to load roles data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions are required to audit roles across the organization."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">No roles found</p>
          <p className="text-sm text-muted-foreground">
            No admin roles exist in the workspace yet.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {roles.length} {roles.length === 1 ? "role" : "roles"} total,{" "}
            {rolesWithAssignees} with assignees
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>System Role</TableHead>
                <TableHead>Super Admin Role</TableHead>
                <TableHead>Assignees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.roleId}>
                  <TableCell className="font-medium">
                    {role.roleName}
                  </TableCell>
                  <TableCell
                    className="max-w-[300px] truncate text-muted-foreground"
                    title={role.roleDescription}
                  >
                    {role.roleDescription || (
                      <span className="text-muted-foreground/50">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isSystemRole ? "secondary" : "outline"}>
                      {role.isSystemRole ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {role.isSuperAdminRole && (
                      <Badge variant="destructive">Super Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {role.assignees.length > 0 ? (
                      role.assignees.length
                    ) : (
                      <span className="text-muted-foreground/50">None</span>
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
