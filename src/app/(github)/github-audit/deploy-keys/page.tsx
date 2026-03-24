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
import { CollectButton } from "@/components/collection/collect-button"
import { Key } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type DeployKey = {
  id: number
  title: string
  key: string
  verified: boolean
  readOnly: boolean
  createdAt: string
}

export default function DeployKeysAuditPage() {
  const { repos, loading: reposLoading } = useGitHubRepos()
  const [selectedRepo, setSelectedRepo] = useState<string>("")

  const [owner, repoName] = selectedRepo ? selectedRepo.split("/") : [null, null]

  const fetcher = useCallback(async () => {
    if (!owner || !repoName) return [] as DeployKey[]
    const res = await fetch(`/api/github/repos/${owner}/${repoName}/deploy-keys`)
    if (!res.ok) throw new Error("Failed to fetch deploy keys")
    const json = await res.json()
    return (json.deployKeys ?? []) as DeployKey[]
  }, [owner, repoName])

  const cacheKey = selectedRepo ? `github:audit:deploy-keys:${selectedRepo}` : null
  const { data: keys, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Deploy Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            SSH deploy keys configured per repository
          </p>
        </div>
        {keys && keys.length > 0 && (
          <ExportButton
            data={keys as unknown as Record<string, unknown>[]}
            filename={`github-deploy-keys-${selectedRepo.replace("/", "-")}`}
            columns={["title", "readOnly", "verified", "createdAt"]}
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
            <Key className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a repository to view its deploy keys
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8" />
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Key (fingerprint)</TableHead>
                <TableHead className="text-xs">Access</TableHead>
                <TableHead className="text-xs">Verified</TableHead>
                <TableHead className="text-xs">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !keys || keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                    No deploy keys found
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="px-1">
                      <CollectButton
                        variant="icon-xs"
                        params={{
                          type: "audit-finding",
                          source: "github",
                          title: `Deploy Key: ${k.title}`,
                          subtitle: selectedRepo,
                          sourceId: `deploy-key:${selectedRepo}:${k.id}`,
                          metadata: {
                            findingType: "deploy-key",
                            repo: selectedRepo,
                            title: k.title,
                            readOnly: k.readOnly,
                            createdAt: k.createdAt,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-medium">{k.title}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">
                        {k.key.slice(0, 40)}...
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${k.readOnly ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}
                      >
                        {k.readOnly ? "Read-only" : "Read-write"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{k.verified ? "Yes" : "No"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString()}
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
