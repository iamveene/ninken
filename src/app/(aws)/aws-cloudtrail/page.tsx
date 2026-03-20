"use client"

import { useState } from "react"
import { useAwsCloudTrailEvents, useAwsCloudTrailTrails } from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Activity, Search, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ca-central-1", "sa-east-1",
]

type CloudTrailTab = "events" | "trails"

export default function AwsCloudTrailPage() {
  const [tab, setTab] = useState<CloudTrailTab>("events")
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState<string | undefined>(undefined)
  const [timeRange, setTimeRange] = useState("24h")

  // Calculate start/end time based on range
  const now = new Date()
  const rangeMs = timeRange === "1h" ? 60 * 60 * 1000
    : timeRange === "6h" ? 6 * 60 * 60 * 1000
    : timeRange === "24h" ? 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000
  const startTime = new Date(now.getTime() - rangeMs).toISOString()
  const endTime = now.toISOString()

  const {
    events, loading: eventsLoading, error: eventsError, refetch: refetchEvents,
  } = useAwsCloudTrailEvents(region, startTime, endTime)

  const {
    trails, loading: trailsLoading, error: trailsError, refetch: refetchTrails,
  } = useAwsCloudTrailTrails(region)

  const filteredEvents = events.filter((e) =>
    !search ||
    e.eventName.toLowerCase().includes(search.toLowerCase()) ||
    e.eventSource.toLowerCase().includes(search.toLowerCase()) ||
    (e.username?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const tabs: { id: CloudTrailTab; label: string; count: number }[] = [
    { id: "events", label: "Events", count: events.length },
    { id: "trails", label: "Trails", count: trails.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            CloudTrail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            API activity and audit logs
          </p>
        </div>
        <ExportButton
          data={
            tab === "events"
              ? (filteredEvents as unknown as Record<string, unknown>[])
              : (trails as unknown as Record<string, unknown>[])
          }
          filename={`aws-cloudtrail-${tab}`}
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch("") }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">{t.count}</Badge>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={tab === "events" ? "Search events..." : "Search trails..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <select
          value={region ?? ""}
          onChange={(e) => setRegion(e.target.value || undefined)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">Default Region</option>
          {AWS_REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {tab === "events" && (
          <div className="flex gap-1">
            {["1h", "6h", "24h", "7d"].map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                className="text-xs h-8 px-2"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Events tab */}
      {tab === "events" && (
        <>
          {eventsError && <ServiceError error={eventsError} onRetry={refetchEvents} />}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Event Name</TableHead>
                  <TableHead className="text-xs">Source</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Source IP</TableHead>
                  <TableHead className="text-xs">R/W</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.eventId}>
                      <TableCell>
                        <span className="text-xs font-medium font-mono">{event.eventName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{event.eventSource}</span>
                      </TableCell>
                      <TableCell className="text-xs">{event.username ?? "-"}</TableCell>
                      <TableCell className="text-xs font-mono">{event.sourceIp ?? "-"}</TableCell>
                      <TableCell>
                        {event.readOnly === true ? (
                          <Eye className="h-3 w-3 text-blue-400" />
                        ) : event.readOnly === false ? (
                          <EyeOff className="h-3 w-3 text-amber-400" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(event.eventTime).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Trails tab */}
      {tab === "trails" && (
        <>
          {trailsError && <ServiceError error={trailsError} onRetry={refetchTrails} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trailsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-20 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))
            ) : trails.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-xs text-muted-foreground">
                  No trails found
                </CardContent>
              </Card>
            ) : (
              trails
                .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))
                .map((trail) => (
                  <Card key={trail.name}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{trail.name}</span>
                        {trail.isLogging === true ? (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Logging
                          </Badge>
                        ) : trail.isLogging === false ? (
                          <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                            <XCircle className="h-2.5 w-2.5 mr-0.5" /> Stopped
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">Unknown</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-1">
                        <p>S3: {trail.s3BucketName ?? "N/A"}</p>
                        <p>Home Region: {trail.homeRegion ?? "N/A"}</p>
                        <p>Multi-Region: {trail.isMultiRegionTrail ? "Yes" : "No"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
