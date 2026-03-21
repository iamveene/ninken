"use client"

import { useState } from "react"
import { useAwsLambdaFunctions } from "@/hooks/use-aws"
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
import { Zap, Search } from "lucide-react"

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ca-central-1", "sa-east-1",
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export default function AwsLambdaPage() {
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState<string | undefined>(undefined)

  const { functions, loading, error, refetch } = useAwsLambdaFunctions(region)

  const filtered = functions.filter((f) =>
    !search || f.functionName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Lambda Functions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {functions.length} functions found
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="aws-lambda-functions"
          columns={["functionName", "runtime", "handler", "codeSize", "memorySize", "timeout", "lastModified"]}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search functions..."
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

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Function Name</TableHead>
              <TableHead className="text-xs">Runtime</TableHead>
              <TableHead className="text-xs">Memory</TableHead>
              <TableHead className="text-xs">Timeout</TableHead>
              <TableHead className="text-xs text-right">Code Size</TableHead>
              <TableHead className="text-xs">Last Modified</TableHead>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No functions found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((fn) => (
                <TableRow key={fn.functionArn}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-medium">{fn.functionName}</span>
                      </div>
                      {fn.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 ml-5.5">{fn.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[9px]">{fn.runtime ?? "unknown"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fn.memorySize ? `${fn.memorySize} MB` : "-"}</TableCell>
                  <TableCell className="text-xs">{fn.timeout ? `${fn.timeout}s` : "-"}</TableCell>
                  <TableCell className="text-right text-xs">{formatBytes(fn.codeSize)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fn.lastModified ? new Date(fn.lastModified).toLocaleDateString() : "-"}
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
