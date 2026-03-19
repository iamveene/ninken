"use client"

import { useState } from "react"
import Link from "next/link"
import { useGitLabProjects } from "@/hooks/use-gitlab"
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
  FolderGit2,
  Search,
  Star,
  GitFork,
  Lock,
  Globe,
  Archive,
  ExternalLink,
} from "lucide-react"

export default function GitLabProjectsPage() {
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const { projects: rawProjects, loading, error, refetch } = useGitLabProjects()

  // Deduplicate projects by ID (GitLab can return same project via multiple group memberships)
  const projects = rawProjects.filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.pathWithNamespace.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesVisibility =
      visibilityFilter === "all" || p.visibility === visibilityFilter
    return matchesSearch && matchesVisibility
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} projects accessible
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="gitlab-projects"
          columns={["name", "pathWithNamespace", "visibility", "stars", "forks", "lastActivityAt"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {["all", "public", "internal", "private"].map((v) => (
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
              <TableHead className="text-xs max-w-[300px]">Project</TableHead>
              <TableHead className="text-xs w-[100px]">Visibility</TableHead>
              <TableHead className="text-xs text-right w-[70px]">Stars</TableHead>
              <TableHead className="text-xs text-right w-[70px]">Forks</TableHead>
              <TableHead className="text-xs w-[100px]">Last Activity</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No projects found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((project) => (
                <TableRow key={`project-${project.id}-${project.pathWithNamespace}`}>
                  <TableCell className="max-w-[300px]">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Link
                          href={`/gitlab-projects/${project.id}?ref=${project.defaultBranch || "main"}`}
                          className="text-xs font-medium text-primary hover:underline truncate block"
                        >
                          {project.pathWithNamespace}
                        </Link>
                        <a
                          href={project.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Open in GitLab"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {project.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      )}
                      <div className="flex gap-1 mt-0.5">
                        {project.forked && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">fork</Badge>
                        )}
                        {project.archived && (
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
                        project.visibility === "private"
                          ? "border-amber-500/30 text-amber-400"
                          : project.visibility === "internal"
                            ? "border-blue-500/30 text-blue-400"
                            : "border-emerald-500/30 text-emerald-400"
                      }`}
                    >
                      {project.visibility === "private" ? (
                        <Lock className="h-2.5 w-2.5 mr-1" />
                      ) : (
                        <Globe className="h-2.5 w-2.5 mr-1" />
                      )}
                      {project.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs flex items-center justify-end gap-1">
                      <Star className="h-3 w-3 text-amber-400" />
                      {project.stars}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs flex items-center justify-end gap-1">
                      <GitFork className="h-3 w-3 text-muted-foreground" />
                      {project.forks}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {project.lastActivityAt
                        ? new Date(project.lastActivityAt).toLocaleDateString()
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CollectButton
                      variant="icon-xs"
                      params={{
                        type: "project",
                        source: "gitlab",
                        title: project.pathWithNamespace,
                        subtitle: project.visibility,
                        sourceId: project.id.toString(),
                        metadata: {
                          description: project.description,
                          visibility: project.visibility,
                          stars: project.stars,
                          forks: project.forks,
                          defaultBranch: project.defaultBranch,
                          webUrl: project.webUrl,
                          lastActivityAt: project.lastActivityAt,
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
