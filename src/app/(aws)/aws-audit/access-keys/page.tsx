"use client"

import { useAwsIamUsers } from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Key, AlertTriangle, CheckCircle2, Users } from "lucide-react"
import { accessKeyAgeDays } from "@/lib/aws-audit"

export default function AwsAuditAccessKeysPage() {
  const { users, loading, error, refetch } = useAwsIamUsers()

  // Flatten all access keys with their user context
  const allKeys = users.flatMap((user) =>
    user.accessKeys.map((key) => ({
      ...key,
      userName: user.userName,
      userArn: user.arn,
      ageDays: accessKeyAgeDays(key.createDate),
    }))
  )

  const activeKeys = allKeys.filter((k) => k.status === "Active")
  const staleKeys = activeKeys.filter((k) => k.ageDays > 90)
  const criticalKeys = activeKeys.filter((k) => k.ageDays > 365)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Access Key Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stale and unused access key detection
          </p>
        </div>
        <ExportButton
          data={allKeys as unknown as Record<string, unknown>[]}
          filename="aws-audit-access-keys"
          columns={["userName", "accessKeyId", "status", "createDate", "ageDays"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{allKeys.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{activeKeys.length}</p>
            <p className="text-[10px] text-muted-foreground">Active Keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{staleKeys.length}</p>
            <p className="text-[10px] text-muted-foreground">Stale ({">"}90 days)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{criticalKeys.length}</p>
            <p className="text-[10px] text-muted-foreground">Critical ({">"}365 days)</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Key ID</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Age (days)</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
              <TableHead className="text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : allKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No access keys found
                </TableCell>
              </TableRow>
            ) : (
              allKeys
                .sort((a, b) => b.ageDays - a.ageDays)
                .map((key) => (
                  <TableRow key={key.accessKeyId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{key.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">{key.accessKeyId}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          key.status === "Active"
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-red-500/30 text-red-400"
                        }`}
                      >
                        {key.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-mono ${
                        key.ageDays > 365 ? "text-red-400 font-bold" :
                        key.ageDays > 90 ? "text-amber-400" :
                        ""
                      }`}>
                        {key.ageDays}
                      </span>
                    </TableCell>
                    <TableCell>
                      {key.status !== "Active" ? (
                        <Badge variant="outline" className="text-[9px] border-neutral-500/30 text-neutral-400">
                          Inactive
                        </Badge>
                      ) : key.ageDays > 365 ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Critical
                        </Badge>
                      ) : key.ageDays > 90 ? (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Stale
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(key.createDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
