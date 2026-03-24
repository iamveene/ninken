"use client"

import { useState } from "react"
import { useAwsEc2Instances, useAwsSecurityGroups } from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Server, Search, Shield } from "lucide-react"

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ca-central-1", "sa-east-1",
]

type Ec2Tab = "instances" | "security-groups"

function stateColor(state: string): string {
  switch (state) {
    case "running": return "border-emerald-500/30 text-emerald-400"
    case "stopped": return "border-red-500/30 text-red-400"
    case "terminated": return "border-neutral-500/30 text-neutral-400"
    case "pending": return "border-amber-500/30 text-amber-400"
    default: return "border-neutral-500/30 text-neutral-400"
  }
}

export default function AwsEc2Page() {
  const [tab, setTab] = useState<Ec2Tab>("instances")
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState<string | undefined>(undefined)

  const {
    instances, loading: instLoading, error: instError, refetch: refetchInst,
  } = useAwsEc2Instances(region)

  const {
    securityGroups, loading: sgLoading, error: sgError, refetch: refetchSg,
  } = useAwsSecurityGroups(region)

  const tabs: { id: Ec2Tab; label: string; count: number }[] = [
    { id: "instances", label: "Instances", count: instances.length },
    { id: "security-groups", label: "Security Groups", count: securityGroups.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            EC2
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elastic Compute Cloud
          </p>
        </div>
        <ExportButton
          data={
            tab === "instances"
              ? (instances as unknown as Record<string, unknown>[])
              : (securityGroups as unknown as Record<string, unknown>[])
          }
          filename={`aws-ec2-${tab}`}
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-4 border-b">
        <div className="flex gap-1">
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
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${tab}...`}
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
      </div>

      {/* Instances tab */}
      {tab === "instances" && (
        <>
          {instError && <ServiceError error={instError} onRetry={refetchInst} />}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name / ID</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">State</TableHead>
                  <TableHead className="text-xs">Public IP</TableHead>
                  <TableHead className="text-xs">Private IP</TableHead>
                  <TableHead className="text-xs">VPC</TableHead>
                  <TableHead className="text-xs">Launched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : instances.filter((inst) =>
                  !search ||
                  (inst.name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
                  inst.instanceId.toLowerCase().includes(search.toLowerCase())
                ).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                      No instances found
                    </TableCell>
                  </TableRow>
                ) : (
                  instances
                    .filter((inst) =>
                      !search ||
                      (inst.name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
                      inst.instanceId.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((inst) => (
                      <TableRow key={inst.instanceId}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">{inst.name ?? inst.instanceId}</span>
                            {inst.name && (
                              <span className="text-[10px] text-muted-foreground font-mono">{inst.instanceId}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px]">{inst.instanceType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[9px] ${stateColor(inst.state)}`}>
                            {inst.state}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {inst.publicIp ?? <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {inst.privateIp ?? <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {inst.vpcId ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inst.launchTime ? new Date(inst.launchTime).toLocaleDateString() : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Security Groups tab */}
      {tab === "security-groups" && (
        <>
          {sgError && <ServiceError error={sgError} onRetry={refetchSg} />}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Group Name</TableHead>
                  <TableHead className="text-xs">Group ID</TableHead>
                  <TableHead className="text-xs">VPC</TableHead>
                  <TableHead className="text-xs text-right">Inbound Rules</TableHead>
                  <TableHead className="text-xs text-right">Outbound Rules</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sgLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : securityGroups.filter((sg) =>
                  !search || sg.groupName.toLowerCase().includes(search.toLowerCase())
                ).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                      No security groups found
                    </TableCell>
                  </TableRow>
                ) : (
                  securityGroups
                    .filter((sg) => !search || sg.groupName.toLowerCase().includes(search.toLowerCase()))
                    .map((sg) => (
                      <TableRow key={sg.groupId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">{sg.groupName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{sg.groupId}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{sg.vpcId ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-[9px]">{sg.inboundRules.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-[9px]">{sg.outboundRules.length}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                          {sg.description ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
