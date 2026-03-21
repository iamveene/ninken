"use client"

import { useState } from "react"
import { useGitHubRepos } from "@/hooks/use-github"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { CollectButton } from "@/components/collection/collect-button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BookMarked,
  Search,
  Star,
  GitFork,
  Lock,
  Globe,
  Archive,
} from "lucide-react"

export default function ReposPage() {
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const { repos, loading, error, refetch } = useGitHubRepos()

  const filtered = repos.filter((r) => {
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesVisibility =
      visibilityFilter === "all" || r.visibility === visibilityFilter
    return matchesSearch && matchesVisibility
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            Repositories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {repos.length} repositories accessible
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="github-repos"
          columns={["name", "fullName", "visibility", "language", "stars", "forks", "updatedAt"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {["all", "public", "private"].map((v) => (
            <Button
              key={v}
              variant={visibilityFilter === v ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setVisibilityFilter(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Repository</TableHead>
              <TableHead className="text-xs">Visibility</TableHead>
              <TableHead className="text-xs">Language</TableHead>
              <TableHead className="text-xs text-right">Stars</TableHead>
              <TableHead className="text-xs text-right">Forks</TableHead>
              <TableHead className="text-xs">Updated</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                  No repositories found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((repo) => (
                <TableRow key={repo.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {repo.fullName}
                      </a>
                      {repo.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex gap-1 mt-0.5">
                        {repo.fork && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">fork</Badge>
                        )}
                        {repo.archived && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            <Archive className="h-2.5 w-2.5 mr-0.5" />
                            archived
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        repo.private
                          ? "border-amber-500/30 text-amber-400"
                          : "border-emerald-500/30 text-emerald-400"
                      }`}
                    >
                      {repo.private ? (
                        <Lock className="h-2.5 w-2.5 mr-1" />
                      ) : (
                        <Globe className="h-2.5 w-2.5 mr-1" />
                      )}
                      {repo.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {repo.language ? (
                      <span className="text-xs">{repo.language}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs flex items-center justify-end gap-1">
                      <Star className="h-3 w-3 text-amber-400" />
                      {repo.stars}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs flex items-center justify-end gap-1">
                      <GitFork className="h-3 w-3 text-muted-foreground" />
                      {repo.forks}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {repo.updatedAt
                        ? new Date(repo.updatedAt).toLocaleDateString()
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CollectButton
                      variant="icon-xs"
                      params={{
                        type: "repo",
                        source: "github",
                        title: repo.fullName,
                        subtitle: repo.visibility,
                        sourceId: repo.id.toString(),
                        metadata: {
                          description: repo.description,
                          language: repo.language,
                          visibility: repo.visibility,
                          stars: repo.stars,
                          forks: repo.forks,
                          defaultBranch: repo.defaultBranch,
                          htmlUrl: repo.htmlUrl,
                          updatedAt: repo.updatedAt,
                        },
                      }}
                    />
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
