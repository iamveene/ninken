"use client"

import { useState, useEffect, useRef } from "react"
import { useAwsS3Buckets } from "@/hooks/use-aws"
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
import { Globe, Database, Shield, AlertTriangle, CheckCircle2 } from "lucide-react"
import { isPublicBucketPolicy } from "@/lib/aws-audit"

type BucketPolicyStatus = {
  bucketName: string
  isPublic: boolean
  policyExists: boolean
  checking: boolean
  error: string | null
}

export default function AwsAuditPublicS3Page() {
  const { buckets, loading, error, refetch } = useAwsS3Buckets()
  const [policyStatuses, setPolicyStatuses] = useState<Record<string, BucketPolicyStatus>>({})
  const [scanning, setScanning] = useState(false)
  const abortRef = useRef(false)

  // Auto-scan on load
  useEffect(() => {
    if (buckets.length === 0 || scanning) return
    if (Object.keys(policyStatuses).length > 0) return

    abortRef.current = false
    setScanning(true)
    const scanBuckets = async () => {
      for (const bucket of buckets) {
        if (abortRef.current) break

        setPolicyStatuses((prev) => ({
          ...prev,
          [bucket.name]: {
            bucketName: bucket.name,
            isPublic: false,
            policyExists: false,
            checking: true,
            error: null,
          },
        }))

        try {
          const res = await fetch(`/api/aws/s3/policy?bucket=${encodeURIComponent(bucket.name)}`)
          if (abortRef.current) break
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          const isPublic = isPublicBucketPolicy(data.policy)

          setPolicyStatuses((prev) => ({
            ...prev,
            [bucket.name]: {
              bucketName: bucket.name,
              isPublic,
              policyExists: data.policy !== null,
              checking: false,
              error: null,
            },
          }))
        } catch (e) {
          if (abortRef.current) break
          setPolicyStatuses((prev) => ({
            ...prev,
            [bucket.name]: {
              bucketName: bucket.name,
              isPublic: false,
              policyExists: false,
              checking: false,
              error: e instanceof Error ? e.message : "Scan failed",
            },
          }))
        }
      }
      if (!abortRef.current) setScanning(false)
    }

    scanBuckets()
    return () => { abortRef.current = true }
  }, [buckets, scanning, policyStatuses])

  const publicBuckets = Object.values(policyStatuses).filter((s) => s.isPublic)
  const scannedCount = Object.values(policyStatuses).filter((s) => !s.checking).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Public S3 Bucket Detection
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scanning {buckets.length} buckets for public access policies
          </p>
        </div>
        <ExportButton
          data={Object.values(policyStatuses) as unknown as Record<string, unknown>[]}
          filename="aws-audit-public-s3"
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
            <p className="text-2xl font-bold">{scannedCount}/{buckets.length}</p>
            <p className="text-[10px] text-muted-foreground">Scanned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {scannedCount - publicBuckets.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Private Buckets</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Bucket</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Policy</TableHead>
              <TableHead className="text-xs">Created</TableHead>
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
            ) : buckets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No buckets found
                </TableCell>
              </TableRow>
            ) : (
              buckets.map((bucket) => {
                const status = policyStatuses[bucket.name]
                return (
                  <TableRow key={bucket.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{bucket.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {!status || status.checking ? (
                        <Badge variant="outline" className="text-[9px] animate-pulse">Scanning...</Badge>
                      ) : status.error ? (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                          Error
                        </Badge>
                      ) : status.isPublic ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> PUBLIC
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Private
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!status || status.checking ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : status.policyExists ? (
                        <Badge variant="secondary" className="text-[9px]">Has Policy</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No Policy</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bucket.creationDate ? new Date(bucket.creationDate).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
