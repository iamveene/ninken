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
import { Play, FileCode } from "lucide-react"
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

export default function ActionsPage() {
  const { repos, loading: reposLoading } = useGitHubRepos()
  const [selectedRepo, setSelectedRepo] = useState<string>("")

  const [owner, repoName] = selectedRepo ? selectedRepo.split("/") : [null, null]

  const workflowsFetcher = useCallback(async () => {
    const res = await fetch(`/api/github/repos/${owner}/${repoName}/actions/workflows`)
    if (!res.ok) throw new Error("Failed to fetch workflows")
    const json = await res.json()
    return (json.workflows ?? []) as Workflow[]
  }, [owner, repoName])

  const cacheKey = selectedRepo ? `github:workflows:${selectedRepo}` : null
  const {
    data: workflows,
    loading: workflowsLoading,
    error: workflowsError,
    refetch,
  } = useCachedQuery(cacheKey, workflowsFetcher, { ttlMs: CACHE_TTL_LIST })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Play className="h-5 w-5" />
            Actions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View GitHub Actions workflows per repository
          </p>
        </div>
        {workflows && workflows.length > 0 && (
          <ExportButton
            data={workflows as unknown as Record<string, unknown>[]}
            filename={`github-workflows-${selectedRepo.replace("/", "-")}`}
            columns={["name", "path", "state", "createdAt"]}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedRepo} onValueChange={(v) => setSelectedRepo(v ?? "")}>
          <SelectTrigger className="w-[300px] h-8 text-xs">
            <SelectValue placeholder="Select a repository..." />
          </SelectTrigger>
          <SelectContent>
            {reposLoading ? (
              <SelectItem value="_loading" disabled>Loading repos...</SelectItem>
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
      </div>

      {workflowsError && <ServiceError error={workflowsError} onRetry={refetch} />}

      {!selectedRepo ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Play className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a repository to view its workflows
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Workflow</TableHead>
                <TableHead className="text-xs">Path</TableHead>
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflowsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !workflows || workflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                    No workflows found in this repository
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
                        className={`text-[10px] ${
                          w.state === "active"
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-amber-500/30 text-amber-400"
                        }`}
                      >
                        {w.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
