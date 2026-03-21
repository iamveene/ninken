"use client"

import { useState, useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import { Search, Monitor, Smartphone, ShieldAlert, AlertCircle } from "lucide-react"
import { useAuditDevices } from "@/hooks/use-audit-devices"
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

type FilterKey = "all" | "chromeos" | "mobile"

function formatLastSync(lastSync: string | null): string {
  if (!lastSync) return "Never"
  const date = new Date(lastSync)
  if (date.getTime() === 0) return "Never"
  return formatDistanceToNow(date, { addSuffix: true })
}

export default function DevicesAuditPage() {
  const { chromeDevices, mobileDevices, scope, loading, error } = useAuditDevices()
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const allDevices = useMemo(() => {
    const chrome = chromeDevices.map((d) => ({ ...d, _type: "chromeos" as const }))
    const mobile = mobileDevices.map((d) => ({ ...d, _type: "mobile" as const }))
    return [...chrome, ...mobile]
  }, [chromeDevices, mobileDevices])

  const filteredDevices = useMemo(() => {
    return allDevices.filter((d) => {
      if (activeFilter === "chromeos" && d._type !== "chromeos") return false
      if (activeFilter === "mobile" && d._type !== "mobile") return false
      if (search) {
        const q = search.toLowerCase()
        const searchable = [
          d.serialNumber,
          d.model,
          d.status,
          d._type === "chromeos" ? d.annotatedUser : d.email,
        ].join(" ").toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
  }, [allDevices, activeFilter, search])

  const isPermissionError =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorized")

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: allDevices.length },
    { key: "chromeos", label: "Chrome OS", count: chromeDevices.length },
    { key: "mobile", label: "Mobile", count: mobileDevices.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Devices Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review Chrome OS devices and mobile devices enrolled in the organization.
        </p>
      </div>

      {/* Scope indicator */}
      {!loading && scope === "limited" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Limited view -- admin privileges required for full device inventory.</span>
        </div>
      )}

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {isPermissionError ? "Access denied" : "Unable to load device data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "Admin permissions are required to audit devices across the organization."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!loading && allDevices.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{chromeDevices.length}</span> Chrome OS devices,{" "}
              <span className="font-medium text-foreground">{mobileDevices.length}</span> mobile devices
            </div>
          )}

          {/* Search and filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by serial, model, user..."
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
                  {!loading && (
                    <span className="ml-1 text-xs text-muted-foreground">{f.count}</span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : allDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Monitor className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No devices found</p>
              <p className="text-sm text-muted-foreground">
                No devices are enrolled in the directory.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User / Email</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Last Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">No devices match the current filters.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => (
                    <TableRow key={device.deviceId}>
                      <TableCell>
                        {device._type === "chromeos" ? (
                          <Badge variant="secondary" className="gap-1">
                            <Monitor className="h-3 w-3" /> Chrome OS
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Smartphone className="h-3 w-3" /> Mobile
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{device.model || "--"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {device.serialNumber || "--"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            device.status === "ACTIVE" || device.status === "APPROVED"
                              ? "secondary"
                              : device.status === "DISABLED" || device.status === "BLOCKED"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {device.status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {device._type === "chromeos" ? device.annotatedUser : device.email || "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {device._type === "chromeos" ? device.osVersion : device.os || "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLastSync(device.lastSync)}
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
