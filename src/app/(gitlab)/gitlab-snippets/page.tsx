"use client"

import { useState } from "react"
import { useGitLabSnippets } from "@/hooks/use-gitlab"
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
  FileCode,
  Search,
  Lock,
  Globe,
  Eye,
} from "lucide-react"

export default function GitLabSnippetsPage() {
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const { snippets, loading, error, refetch } = useGitLabSnippets()

  const filtered = snippets.filter((s) => {
    const matchesSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (s.fileName?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesVisibility =
      visibilityFilter === "all" || s.visibility === visibilityFilter
    return matchesSearch && matchesVisibility
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Snippets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {snippets.length} snippets accessible
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="gitlab-snippets"
          columns={["title", "visibility", "fileName", "author", "createdAt"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
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
              <TableHead className="text-xs">Snippet</TableHead>
              <TableHead className="text-xs">Visibility</TableHead>
              <TableHead className="text-xs">File</TableHead>
              <TableHead className="text-xs">Author</TableHead>
              <TableHead className="text-xs">Updated</TableHead>
              <TableHead className="text-xs w-10" />
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No snippets found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((snippet) => (
                <TableRow key={snippet.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={snippet.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {snippet.title}
                      </a>
                      {snippet.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {snippet.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        snippet.visibility === "private"
                          ? "border-amber-500/30 text-amber-400"
                          : snippet.visibility === "internal"
                            ? "border-blue-500/30 text-blue-400"
                            : "border-emerald-500/30 text-emerald-400"
                      }`}
                    >
                      {snippet.visibility === "private" ? (
                        <Lock className="h-2.5 w-2.5 mr-1" />
                      ) : snippet.visibility === "internal" ? (
                        <Eye className="h-2.5 w-2.5 mr-1" />
                      ) : (
                        <Globe className="h-2.5 w-2.5 mr-1" />
                      )}
                      {snippet.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {snippet.fileName || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {snippet.author}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {snippet.updatedAt
                        ? new Date(snippet.updatedAt).toLocaleDateString()
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CollectButton
                      variant="icon-xs"
                      params={{
                        type: "snippet",
                        source: "gitlab",
                        title: snippet.title,
                        subtitle: snippet.visibility,
                        sourceId: snippet.id.toString(),
                        metadata: {
                          description: snippet.description,
                          visibility: snippet.visibility,
                          fileName: snippet.fileName,
                          author: snippet.author,
                          webUrl: snippet.webUrl,
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
