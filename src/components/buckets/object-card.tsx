"use client"

import { formatDistanceToNow } from "date-fns"
import {
  Folder,
  FileText,
  FileImage,
  File,
  Film,
  FileArchive,
  FileCode,
  Music,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { CollectButton } from "@/components/collection/collect-button"
import { formatFileSize } from "@/components/drive/file-card"
import type { StorageObject } from "@/hooks/use-buckets"

const CONTENT_TYPE_CONFIG: Record<string, { icon: typeof File; color: string; label: string }> = {
  "application/pdf": { icon: FileText, color: "text-red-600 dark:text-red-400", label: "PDF" },
  "text/plain": { icon: FileText, color: "text-gray-600 dark:text-gray-400", label: "Text" },
  "text/html": { icon: FileCode, color: "text-orange-600 dark:text-orange-400", label: "HTML" },
  "application/json": { icon: FileCode, color: "text-emerald-600 dark:text-emerald-400", label: "JSON" },
}

export function getObjectConfig(contentType?: string) {
  if (!contentType) return { icon: File, color: "text-gray-500 dark:text-gray-400", label: "File" }
  if (CONTENT_TYPE_CONFIG[contentType]) return CONTENT_TYPE_CONFIG[contentType]
  if (contentType.startsWith("image/")) return { icon: FileImage, color: "text-pink-600 dark:text-pink-400", label: "Image" }
  if (contentType.startsWith("video/")) return { icon: Film, color: "text-red-500 dark:text-red-400", label: "Video" }
  if (contentType.startsWith("audio/")) return { icon: Music, color: "text-indigo-600 dark:text-indigo-400", label: "Audio" }
  if (contentType.includes("zip") || contentType.includes("archive") || contentType.includes("compressed"))
    return { icon: FileArchive, color: "text-amber-700 dark:text-amber-400", label: "Archive" }
  if (contentType.includes("javascript") || contentType.includes("xml"))
    return { icon: FileCode, color: "text-emerald-600 dark:text-emerald-400", label: "Code" }
  return { icon: File, color: "text-gray-500 dark:text-gray-400", label: "File" }
}

export function getFolderConfig() {
  return { icon: Folder, color: "text-amber-500 dark:text-amber-400", label: "Folder" }
}

type ObjectCardProps = {
  object?: StorageObject
  prefix?: string
  bucketName?: string
  view: "grid" | "list"
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  onDownload?: () => void
}

export function ObjectCard({
  object,
  prefix,
  bucketName,
  view,
  selected,
  disabled,
  onClick,
  onDoubleClick,
  onDownload,
}: ObjectCardProps) {
  const isFolder = !!prefix
  const config = isFolder ? getFolderConfig() : getObjectConfig(object?.contentType)
  const Icon = config.icon
  const displayName = isFolder
    ? prefix.replace(/\/$/, "").split("/").pop() || prefix
    : object?.name?.split("/").pop() || object?.name || ""
  const modifiedAgo = object?.updated
    ? formatDistanceToNow(new Date(object.updated), { addSuffix: true })
    : ""

  if (view === "list") return null // handled by object-browser table

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 transition-all duration-150 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 dark:hover:shadow-black/20",
        selected && "border-primary bg-primary/5 shadow-md ring-2 ring-primary/25",
        disabled && !isFolder && "opacity-50 cursor-default hover:shadow-none hover:border-border hover:translate-y-0"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {isFolder && bucketName && (
        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <CollectButton
            variant="icon-xs"
            params={{
              type: "folder",
              source: "gcs",
              title: displayName,
              sourceId: `${bucketName}/${prefix}`,
              metadata: { bucket: bucketName, prefix },
            }}
          />
        </div>
      )}
      {!isFolder && (
        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {object && (
            <CollectButton
              variant="icon-xs"
              params={{
                type: "object",
                source: "gcs",
                title: displayName,
                subtitle: object.bucket,
                sourceId: `${object.bucket}/${object.name}`,
                downloadUrl: `/api/gcp/buckets/${object.bucket}/objects/download?path=${encodeURIComponent(object.name)}`,
                mimeType: object.contentType,
                sizeBytes: object.size ? parseInt(object.size, 10) : undefined,
                metadata: {
                  bucket: object.bucket,
                  fullPath: object.name,
                  storageClass: object.storageClass,
                },
              }}
            />
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Download ${displayName}`}
              onClick={(e) => { e.stopPropagation(); onDownload() }}
            >
              <Download />
            </Button>
          )}
        </div>
      )}

      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-xl",
        isFolder ? "bg-amber-50 dark:bg-amber-950/40" : "bg-muted/80"
      )}>
        <Icon className={cn("h-8 w-8", config.color)} />
      </div>

      <Tooltip>
        <TooltipTrigger className="w-full">
          <p className="w-full truncate text-center text-sm font-medium">{displayName}</p>
        </TooltipTrigger>
        <TooltipContent>{displayName}</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {!isFolder && object?.size && <span>{formatFileSize(object.size)}</span>}
        {modifiedAgo && <span>{modifiedAgo}</span>}
        {isFolder && <span>Folder</span>}
      </div>
    </div>
  )
}
