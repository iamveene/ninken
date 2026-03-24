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
import { GitBranch, Shield, ShieldOff } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type Branch = {
  name: string
  protected: boolean
  protectionEnabled: boolean
}

export default function BranchProtectionsAuditPage() {
  const { repos, loading: reposLoading } = useGitHubRepos()
  const [selectedRepo, setSelectedRepo] = useState<string>("")

  const [owner, repoName] = selectedRepo ? selectedRepo.split("/") : [null, null]

  const fetcher = useCallback(async () => {
    if (!owner || !repoName) return [] as Branch[]
    const res = await fetch(`/api/github/repos/${owner}/${repoName}/branches`)
    if (!res.ok) throw new Error("Failed to fetch branches")
    const json = await res.json()
    return (json.branches ?? []) as Branch[]
  }, [owner, repoName])

  const cacheKey = selectedRepo ? `github:audit:branches:${selectedRepo}` : null
  const { data: branches, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  const protectedCount = branches?.filter((b) => b.protected).length ?? 0
  const totalCount = branches?.length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Branch Protections
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Branch protection rules per repository
          </p>
        </div>
        {branches && branches.length > 0 && (
          <ExportButton
            data={branches as unknown as Record<string, unknown>[]}
            filename={`github-branches-${selectedRepo.replace("/", "-")}`}
            columns={["name", "protected", "protectionEnabled"]}
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

      {error && <ServiceError error={error} onRetry={refetch} />}

      {!selectedRepo ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a repository to view branch protections
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {branches && branches.length > 0 && (
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{protectedCount}/{totalCount} branches protected</span>
            </div>
          )}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Branch</TableHead>
                  <TableHead className="text-xs">Protected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 2 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !branches || branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-8">
                      No branches found
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell>
                        <span className="text-xs font-mono">{b.name}</span>
                      </TableCell>
                      <TableCell>
                        {b.protected ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                            <Shield className="h-2.5 w-2.5 mr-1" />
                            Protected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                            <ShieldOff className="h-2.5 w-2.5 mr-1" />
                            Unprotected
                          </Badge>
                        )}
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
