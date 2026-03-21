"use client"

import { useState, useEffect } from "react"
import { useGcpComputeInstances } from "@/hooks/use-gcp-key"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Server, Search } from "lucide-react"

const PROJECT_ID_KEY = "ninken:gcp:projectId"

function statusColor(status: string): string {
  switch (status) {
    case "RUNNING": return "border-emerald-500/30 text-emerald-400"
    case "STOPPED": return "border-red-500/30 text-red-400"
    case "TERMINATED": return "border-neutral-500/30 text-neutral-400"
    case "STAGING":
    case "PROVISIONING": return "border-amber-500/30 text-amber-400"
    case "SUSPENDED": return "border-purple-500/30 text-purple-400"
    default: return "border-neutral-500/30 text-neutral-400"
  }
}

export default function GcpComputePage() {
  const [projectId, setProjectId] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const stored = sessionStorage.getItem(PROJECT_ID_KEY)
    if (stored) setProjectId(stored)
  }, [])

  const handleProjectChange = (v: string) => {
    setProjectId(v)
    if (v) sessionStorage.setItem(PROJECT_ID_KEY, v)
    else sessionStorage.removeItem(PROJECT_ID_KEY)
  }

  const {
    instances, loading, error, refetch,
  } = useGcpComputeInstances(projectId || undefined)

  const filteredInstances = instances.filter((inst) =>
    !search ||
    inst.name?.toLowerCase().includes(search.toLowerCase()) ||
    inst._zone?.toLowerCase().includes(search.toLowerCase()),
  )

  // Group by zone
  const byZone = new Map<string, typeof instances>()
  for (const inst of filteredInstances) {
    const zone = inst._zone ?? "unknown"
    const group = byZone.get(zone) ?? []
    group.push(inst)
    byZone.set(zone, group)
  }

  if (!projectId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5" />
          Compute Engine
        </h1>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Enter a GCP project ID to list Compute Engine instances.
            </p>
            <Input
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              placeholder="Enter GCP project ID"
              className="h-8 text-xs font-mono"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            Compute Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project: {projectId} &middot; {instances.length} instance{instances.length !== 1 ? "s" : ""} across {byZone.size} zone{byZone.size !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            placeholder="Project ID"
            className="h-8 text-xs font-mono w-48"
          />
          <ExportButton
            data={instances as unknown as Record<string, unknown>[]}
            filename="gcp-compute-instances"
          />
        </div>
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search instances or zones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Zone</TableHead>
              <TableHead className="text-xs">Machine Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Internal IP</TableHead>
              <TableHead className="text-xs">External IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredInstances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No instances found
                </TableCell>
              </TableRow>
            ) : (
              filteredInstances.map((inst) => {
                const machineType = inst.machineType?.split("/").pop() ?? inst.machineType
                const internalIp = inst.networkInterfaces?.[0]?.networkIP ?? "-"
                const externalIp = inst.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP ?? "-"

                return (
                  <TableRow key={`${inst._zone}-${inst.name}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{inst.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {inst._zone}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[9px]">{machineType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${statusColor(inst.status)}`}>
                        {inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {internalIp}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {externalIp}
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
