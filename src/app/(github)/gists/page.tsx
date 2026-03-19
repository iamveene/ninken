"use client"

import { useState } from "react"
import { useGitHubGists } from "@/hooks/use-github"
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
import {
  FileCode,
  Search,
  Globe,
  Lock,
} from "lucide-react"

export default function GistsPage() {
  const [search, setSearch] = useState("")
  const { gists, loading, error, refetch } = useGitHubGists()

  const filtered = gists.filter(
    (g) =>
      !search ||
      (g.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      g.files.some((f) => f.filename.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Gists
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {gists.length} gists
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="github-gists"
          columns={["description", "public", "createdAt", "updatedAt"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search gists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Files</TableHead>
              <TableHead className="text-xs">Visibility</TableHead>
              <TableHead className="text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No gists found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((gist) => (
                <TableRow key={gist.id}>
                  <TableCell>
                    <a
                      href={gist.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {gist.description || "(no description)"}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {gist.files.slice(0, 3).map((f) => (
                        <Badge key={f.filename} variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                          {f.filename}
                        </Badge>
                      ))}
                      {gist.files.length > 3 && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          +{gist.files.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        gist.public
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {gist.public ? (
                        <Globe className="h-2.5 w-2.5 mr-1" />
                      ) : (
                        <Lock className="h-2.5 w-2.5 mr-1" />
                      )}
                      {gist.public ? "Public" : "Secret"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {new Date(gist.createdAt).toLocaleDateString()}
                    </span>
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
