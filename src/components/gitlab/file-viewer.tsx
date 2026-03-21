"use client"

import { ExternalLink, X, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CollectButton } from "@/components/collection/collect-button"
import type { GitLabFileContent } from "@/hooks/use-gitlab"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function decodeContent(content: string | null, encoding: string): string {
  if (!content) return ""
  if (encoding === "base64") {
    try {
      return atob(content)
    } catch {
      return content
    }
  }
  return content
}

type FileViewerProps = {
  file: GitLabFileContent
  projectId: string
  projectWebUrl?: string
  gitRef: string
  onClose: () => void
}

export function GitLabFileViewer({
  file,
  projectId,
  projectWebUrl,
  gitRef,
  onClose,
}: FileViewerProps) {
  const decoded = decodeContent(file.content, file.encoding)
  const externalUrl = projectWebUrl
    ? `${projectWebUrl}/-/blob/${gitRef}/${file.filePath}`
    : null

  return (
    <div className="flex flex-col gap-3 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{file.fileName}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {formatBytes(file.size)}
          </Badge>
          {file.truncated && (
            <Badge variant="secondary" className="text-[10px] shrink-0 text-amber-400 border-amber-500/30">
              truncated
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <CollectButton
            variant="icon-xs"
            params={{
              type: "file",
              source: "gitlab",
              title: file.fileName,
              subtitle: file.filePath,
              sourceId: `gitlab-file-${projectId}-${file.filePath}`,
              downloadUrl: `/api/gitlab/projects/${projectId}/file?path=${encodeURIComponent(file.filePath)}&ref=${encodeURIComponent(gitRef)}&download=true`,
              sizeBytes: file.size,
              metadata: {
                projectId,
                filePath: file.filePath,
                ref: gitRef,
                encoding: file.encoding,
                size: file.size,
              },
            }}
          />
          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" title="Open in GitLab" className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-accent transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onClose} title="Close file viewer">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Path */}
      <p className="text-[11px] text-muted-foreground truncate">{file.filePath}</p>

      {/* Content */}
      {file.truncated && !file.content ? (
        <div className="rounded-md border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            File too large to display.
          </p>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              View on GitLab
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-md border bg-muted/30 overflow-auto max-h-[600px]">
          <pre className="p-4 text-xs font-mono whitespace-pre overflow-x-auto">
            <code>{decoded}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
