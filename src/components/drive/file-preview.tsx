"use client"

import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { X, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getFileConfig, formatFileSize } from "@/components/drive/file-card"
import { useFileInfo } from "@/hooks/use-drive"

type FilePreviewProps = {
  fileId: string | null
  onClose: () => void
}

export function FilePreview({ fileId, onClose }: FilePreviewProps) {
  const { file, loading, error } = useFileInfo(fileId)
  const [thumbError, setThumbError] = useState(false)

  useEffect(() => {
    setThumbError(false)
  }, [fileId])

  if (!fileId) return null

  const config = file ? getFileConfig(file.mimeType) : null
  const Icon = config?.icon

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-medium">Details</h3>
        <Button variant="ghost" size="icon-xs" aria-label="Close details panel" onClick={onClose}>
          <X />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : file ? (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 p-6">
            {file.thumbnailLink && !thumbError ? (
              <img
                src={file.thumbnailLink.replace(/=s\d+/, "=s400")}
                alt={file.name}
                className="max-h-40 max-w-full rounded-lg border object-contain"
                onError={() => setThumbError(true)}
              />
            ) : Icon ? (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted/80">
                <Icon className={`h-12 w-12 ${config?.color}`} />
              </div>
            ) : null}
            <p className="text-center text-sm font-medium">{file.name}</p>
            {config && (
              <Badge variant="secondary" className="text-xs">
                {config.label}
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-3 p-4">
            <DetailRow label="Type" value={config?.label || file.mimeType} />
            {file.size && <DetailRow label="Size" value={formatFileSize(file.size)} />}
            {file.createdTime && (
              <DetailRow
                label="Created"
                value={formatDistanceToNow(new Date(file.createdTime), { addSuffix: true })}
              />
            )}
            {file.modifiedTime && (
              <DetailRow
                label="Modified"
                value={formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
              />
            )}
            {file.owners?.[0] && (
              <DetailRow label="Owner" value={file.owners[0].displayName || file.owners[0].emailAddress} />
            )}
            {file.description && <DetailRow label="Description" value={file.description} />}
          </div>

          <Separator />

          <div className="space-y-2 p-4">
            {file.webViewLink && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => window.open(file.webViewLink, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Google
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => window.open(`/api/drive/files/${file.id}/download`, "_blank")}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">Select a file to see details</p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
