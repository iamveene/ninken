"use client"

import { ShieldCheck, AlertCircle } from "lucide-react"
import { useEntraRoles } from "@/hooks/use-entra"
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

export default function M365RolesAuditPage() {
  const { roles, loading, error } = useEntraRoles()

  const isPermissionError =
    error != null &&
    (error.includes("403") || error.includes("Forbidden") || error.includes("Authorization"))

  const rolesWithMembers = roles.filter((r) => r.members.length > 0).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Roles Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review Entra ID directory roles, built-in and custom role definitions, and member assignments.
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
              <p className="font-medium">{isPermissionError ? "Access denied" : "Unable to load roles data"}</p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "RoleManagement.Read.Directory permission is required to audit Entra ID roles."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">No roles found</p>
          <p className="text-sm text-muted-foreground">No directory roles were returned.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {roles.length} {roles.length === 1 ? "role" : "roles"} total,{" "}
            {rolesWithMembers} with assigned members
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.displayName}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground" title={role.description || ""}>
                    {role.description || <span className="text-muted-foreground/50">--</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isBuiltIn ? "secondary" : "outline"}>
                      {role.isBuiltIn ? "Built-in" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {role.members.length > 0 ? (
                      <div className="space-y-0.5">
                        {role.members.map((m) => (
                          <p key={m.id} className="text-xs">
                            {m.displayName || m.userPrincipalName}
                          </p>
                        ))}
                      </div>
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
