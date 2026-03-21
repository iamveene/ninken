"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Image,
  FileCode,
  FileSpreadsheet,
  Film,
  Music,
  File,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { useSlackFiles } from "@/hooks/use-slack"

function fileIcon(filetype: string) {
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(filetype))
    return Image
  if (["mp4", "mov", "avi", "webm"].includes(filetype)) return Film
  if (["mp3", "wav", "ogg", "flac"].includes(filetype)) return Music
  if (["js", "ts", "py", "go", "rb", "java", "c", "cpp", "rs", "sh"].includes(filetype))
    return FileCode
  if (["csv", "xls", "xlsx"].includes(filetype)) return FileSpreadsheet
  if (["pdf", "doc", "docx", "txt", "md"].includes(filetype)) return FileText
  return File
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function SlackFilesPage() {
  const [page, setPage] = useState(1)
  const { files, paging, loading, error, refetch } = useSlackFiles(
    undefined,
    page,
    50
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Files</h1>
          <p className="text-xs text-muted-foreground">
            {paging.total > 0
              ? `${paging.total} files across workspace`
              : "Loading..."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs text-primary underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No files found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">
                  Type
                </th>
                <th className="text-left p-3 font-medium hidden md:table-cell">
                  Size
                </th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">
                  User
                </th>
                <th className="text-left p-3 font-medium hidden md:table-cell">
                  Date
                </th>
                <th className="text-left p-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const Icon = fileIcon(f.filetype)
                return (
                  <tr
                    key={f.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate max-w-[200px] sm:max-w-[300px]">
                          {f.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant="secondary" className="text-[10px]">
                        {f.filetype}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {formatSize(f.size)}
                    </td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell font-mono">
                      {f.user}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {formatDate(f.created)}
                    </td>
                    <td className="p-3">
                      <a
                        href={f.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {paging.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {paging.page} of {paging.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= paging.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
