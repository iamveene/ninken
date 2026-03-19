"use client"

import { formatDistanceToNow } from "date-fns"
import { X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFileSize } from "@/components/drive/file-card"
import { getObjectConfig } from "@/components/buckets/object-card"
import { useObjectMetadata, useDownloadObject } from "@/hooks/use-buckets"

type ObjectPreviewProps = {
  bucket: string
  path: string | null
  onClose: () => void
}

export function ObjectPreview({ bucket, path, onClose }: ObjectPreviewProps) {
  const { metadata, loading, error } = useObjectMetadata(bucket, path)
  const { download } = useDownloadObject()

  if (!path) return null

  const config = metadata ? getObjectConfig(metadata.contentType) : null
  const Icon = config?.icon
  const fileName = path.split("/").pop() || path
  const isImage = metadata?.contentType?.startsWith("image/")

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
      ) : metadata ? (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 p-6">
            {isImage ? (
              <img
                src={`/api/gcp/buckets/${encodeURIComponent(bucket)}/objects/download?path=${encodeURIComponent(path)}`}
                alt={fileName}
                className="max-h-40 max-w-full rounded-lg border object-contain"
              />
            ) : Icon ? (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted/80">
                <Icon className={`h-12 w-12 ${config?.color}`} />
              </div>
            ) : null}
            <p className="text-center text-sm font-medium">{fileName}</p>
            {config && (
              <Badge variant="secondary" className="text-xs">
                {config.label}
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-3 p-4">
            <DetailRow label="Content Type" value={metadata.contentType || "Unknown"} />
            {metadata.size && <DetailRow label="Size" value={formatFileSize(metadata.size)} />}
            {metadata.timeCreated && (
              <DetailRow
                label="Created"
                value={formatDistanceToNow(new Date(metadata.timeCreated), { addSuffix: true })}
              />
            )}
            {metadata.updated && (
              <DetailRow
                label="Updated"
                value={formatDistanceToNow(new Date(metadata.updated), { addSuffix: true })}
              />
            )}
            {metadata.storageClass && (
              <DetailRow label="Storage Class" value={metadata.storageClass} />
            )}
            {metadata.md5Hash && <DetailRow label="MD5" value={metadata.md5Hash} />}
            {metadata.crc32c && <DetailRow label="CRC32C" value={metadata.crc32c} />}
          </div>

          <Separator />

          <div className="space-y-2 p-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => download(bucket, path)}
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
          <p className="text-sm text-muted-foreground">Select an object to see details</p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm break-all">{value}</p>
    </div>
  )
}
