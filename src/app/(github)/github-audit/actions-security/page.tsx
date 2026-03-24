"use client"

import { useState, useCallback } from "react"
import { useGitHubRepos } from "@/hooks/use-github"
import { useCachedQuery } from "@/hooks/use-cached"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShieldCheck, FileCode } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type Workflow = {
  id: number
  name: string
  path: string
  state: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
}

type Runner = {
  id: number
  name: string
  os: string
  status: string
  busy: boolean
  labels: string[]
}

export default function ActionsSecurityAuditPage() {
  const { repos, loading: reposLoading } = useGitHubRepos()
  const [selectedRepo, setSelectedRepo] = useState<string>("")

  const [owner, repoName] = selectedRepo ? selectedRepo.split("/") : [null, null]

  const workflowsFetcher = useCallback(async () => {
    if (!owner || !repoName) return [] as Workflow[]
    const res = await fetch(`/api/github/repos/${owner}/${repoName}/actions/workflows`)
    if (!res.ok) throw new Error("Failed to fetch workflows")
    const json = await res.json()
    return (json.workflows ?? []) as Workflow[]
  }, [owner, repoName])

  const runnersFetcher = useCallback(async () => {
    if (!owner || !repoName) return [] as Runner[]
    const res = await fetch(`/api/github/repos/${owner}/${repoName}/actions/runners`)
    if (!res.ok) throw new Error("Failed to fetch runners")
    const json = await res.json()
    return (json.runners ?? []) as Runner[]
  }, [owner, repoName])

  const wfKey = selectedRepo ? `github:audit:workflows:${selectedRepo}` : null
  const rnKey = selectedRepo ? `github:audit:runners:${selectedRepo}` : null

  const { data: workflows, loading: wfLoading, error: wfError, refetch: refetchWf } = useCachedQuery(wfKey, workflowsFetcher, { ttlMs: CACHE_TTL_LIST })
  const { data: runners, loading: rnLoading, error: rnError, refetch: refetchRn } = useCachedQuery(rnKey, runnersFetcher, { ttlMs: CACHE_TTL_LIST })

  const allData = [
    ...(workflows ?? []).map((w) => ({ ...w, _type: "workflow" })),
    ...(runners ?? []).map((r) => ({ ...r, _type: "runner" })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Actions Security
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workflows and self-hosted runners per repository
          </p>
        </div>
        {allData.length > 0 && (
          <ExportButton
            data={allData as unknown as Record<string, unknown>[]}
            filename={`github-actions-security-${selectedRepo.replace("/", "-")}`}
          />
        )}
      </div>

      <Select value={selectedRepo} onValueChange={(v) => setSelectedRepo(v ?? "")}>
        <SelectTrigger className="w-[300px] h-8 text-xs">
          <SelectValue placeholder="Select a repository..." />
        </SelectTrigger>
        <SelectContent>
          {reposLoading ? (
            <SelectItem value="_loading" disabled>Loading...</SelectItem>
          ) : repos.length === 0 ? (
            <SelectItem value="_empty" disabled>No repos available</SelectItem>
          ) : (
            repos.map((r) => (
              <SelectItem key={r.id} value={r.fullName} className="text-xs">
                {r.fullName}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {(wfError || rnError) && (
        <ServiceError error={wfError || rnError} onRetry={() => { refetchWf(); refetchRn() }} />
      )}

      {!selectedRepo ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a repository to audit its Actions security
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Workflows */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Workflows</h2>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Workflow</TableHead>
                    <TableHead className="text-xs">Path</TableHead>
                    <TableHead className="text-xs">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wfLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 3 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 animate-pulse rounded bg-muted" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !workflows || workflows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                        No workflows
                      </TableCell>
                    </TableRow>
                  ) : (
                    workflows.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>
                          <a
                            href={w.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {w.name}
                          </a>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                            <FileCode className="h-3 w-3" />
                            {w.path}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${w.state === "active" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}`}
                          >
                            {w.state}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Runners */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Self-Hosted Runners</h2>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">OS</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Labels</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rnLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 animate-pulse rounded bg-muted" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !runners || runners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                        No self-hosted runners
                      </TableCell>
                    </TableRow>
                  ) : (
                    runners.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs">{r.os}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${r.status === "online" ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.labels.slice(0, 3).map((l) => (
                              <Badge key={l} variant="secondary" className="text-[9px] px-1.5 py-0">
                                {l}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
