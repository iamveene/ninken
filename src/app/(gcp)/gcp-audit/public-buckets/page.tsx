"use client"

import { useGcpAuditBuckets } from "@/hooks/use-gcp-audit"
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
import { Globe, Database, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function GcpPublicBucketsPage() {
  const { results, loading, error, refetch } = useGcpAuditBuckets()

  const publicBuckets = results.filter((b) => b.isPublic)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Public Buckets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cloud Storage buckets with public IAM bindings
          </p>
        </div>
        <ExportButton
          data={results as unknown as Record<string, unknown>[]}
          filename="gcp-audit-public-buckets"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{publicBuckets.length}</p>
            <p className="text-[10px] text-muted-foreground">Public Buckets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {results.length - publicBuckets.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Private Buckets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{results.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Buckets</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Bucket Name</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Public Members</TableHead>
              <TableHead className="text-xs">Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No buckets found
                </TableCell>
              </TableRow>
            ) : (
              [...results]
                .sort((a, b) => (a.isPublic === b.isPublic ? 0 : a.isPublic ? -1 : 1))
                .map((bucket) => (
                  <TableRow key={bucket.bucketName}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{bucket.bucketName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {bucket.isPublic ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> PUBLIC
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Private
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bucket.publicMembers.length > 0
                        ? bucket.publicMembers.join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bucket.roles.length > 0
                        ? bucket.roles.map((r) => r.split("/").pop()).join(", ")
                        : "-"}
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
