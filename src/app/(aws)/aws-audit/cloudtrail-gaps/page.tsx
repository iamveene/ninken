"use client"

import { useMemo } from "react"
import { useAwsCloudTrailTrails } from "@/hooks/use-aws"
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
import { MapPin, CheckCircle2, XCircle, Globe } from "lucide-react"
import { analyzeCloudTrailGaps } from "@/lib/aws-audit"

export default function AwsCloudTrailGapsPage() {
  const { trails, loading, error, refetch } = useAwsCloudTrailTrails()

  const gaps = useMemo(() => {
    if (trails.length === 0 && loading) return []
    return analyzeCloudTrailGaps(trails)
  }, [trails, loading])

  const coveredRegions = gaps.filter((g) => g.hasTrail)
  const uncoveredRegions = gaps.filter((g) => !g.hasTrail)
  const hasMultiRegion = trails.some((t) => t.isMultiRegionTrail)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            CloudTrail Coverage Gaps
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regional CloudTrail trail coverage analysis
          </p>
        </div>
        <ExportButton
          data={gaps as unknown as Record<string, unknown>[]}
          filename="aws-audit-cloudtrail-gaps"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{trails.length}</p>
            <p className="text-[10px] text-muted-foreground">Configured Trails</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{coveredRegions.length}</p>
            <p className="text-[10px] text-muted-foreground">Covered Regions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${uncoveredRegions.length > 0 ? "text-red-400" : ""}`}>
              {uncoveredRegions.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Uncovered Regions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${hasMultiRegion ? "text-emerald-400" : "text-amber-400"}`}>
              {hasMultiRegion ? "Yes" : "No"}
            </p>
            <p className="text-[10px] text-muted-foreground">Multi-Region Trail</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Region</TableHead>
              <TableHead className="text-xs">Coverage</TableHead>
              <TableHead className="text-xs">Trail</TableHead>
              <TableHead className="text-xs">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : gaps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No trail data available
                </TableCell>
              </TableRow>
            ) : (
              [...gaps]
                .sort((a, b) => (a.hasTrail === b.hasTrail ? 0 : a.hasTrail ? 1 : -1))
                .map((gap) => (
                  <TableRow key={gap.region}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium font-mono">{gap.region}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {gap.hasTrail ? (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Covered
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                          <XCircle className="h-2.5 w-2.5 mr-0.5" /> Gap
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {gap.trailName ?? "-"}
                    </TableCell>
                    <TableCell>
                      {gap.isMultiRegion ? (
                        <Badge variant="secondary" className="text-[9px]">Multi-Region</Badge>
                      ) : gap.hasTrail ? (
                        <Badge variant="secondary" className="text-[9px]">Regional</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
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
