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
import { Lock } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type Collaborator = {
  login: string
  id: number
  avatarUrl: string
  htmlUrl: string
  type: string
  siteAdmin: boolean
  permissions: { admin: boolean; maintain: boolean; push: boolean; triage: boolean; pull: boolean } | null
  roleName: string | null
}

export default function RepoAccessAuditPage() {
  const { repos, loading: reposLoading } = useGitHubRepos()
  const [selectedRepo, setSelectedRepo] = useState<string>("")

  const [owner, repoName] = selectedRepo ? selectedRepo.split("/") : [null, null]

  const fetcher = useCallback(async () => {
    if (!owner || !repoName) return [] as Collaborator[]
    const res = await fetch(`/api/github/repos/${owner}/${repoName}/collaborators`)
    if (!res.ok) throw new Error("Failed to fetch collaborators")
    const json = await res.json()
    return (json.collaborators ?? []) as Collaborator[]
  }, [owner, repoName])

  const cacheKey = selectedRepo ? `github:audit:collaborators:${selectedRepo}` : null
  const { data: collaborators, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Repo Access
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Repository collaborators and their permission levels
          </p>
        </div>
        {collaborators && collaborators.length > 0 && (
          <ExportButton
            data={collaborators as unknown as Record<string, unknown>[]}
            filename={`github-repo-access-${selectedRepo.replace("/", "-")}`}
            columns={["login", "roleName", "type"]}
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
            <Lock className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a repository to view its collaborators
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !collaborators || collaborators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                    No collaborators found
                  </TableCell>
                </TableRow>
              ) : (
                collaborators.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <a
                        href={c.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {c.login}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          c.roleName === "admin"
                            ? "border-red-500/30 text-red-400"
                            : "border-blue-500/30 text-blue-400"
                        }`}
                      >
                        {c.roleName || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.permissions ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(c.permissions)
                            .filter(([, v]) => v)
                            .map(([k]) => (
                              <Badge key={k} variant="secondary" className="text-[9px] px-1.5 py-0">
                                {k}
                              </Badge>
                            ))}
                        </div>
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
      )}
    </div>
  )
}
