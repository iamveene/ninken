"use client"

import { formatDistanceToNow } from "date-fns"
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  File,
  Film,
  FileArchive,
  FileCode,
  Music,
  Download,
  Share2,
  MoreHorizontal,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { DriveFile } from "@/hooks/use-drive"

const FILE_TYPE_CONFIG: Record<string, { icon: typeof File; color: string; label: string }> = {
  "application/vnd.google-apps.folder": { icon: Folder, color: "text-amber-500 dark:text-amber-400", label: "Folder" },
  "application/vnd.google-apps.document": { icon: FileText, color: "text-blue-600 dark:text-blue-400", label: "Google Doc" },
  "application/vnd.google-apps.spreadsheet": { icon: FileSpreadsheet, color: "text-green-600 dark:text-green-400", label: "Google Sheet" },
  "application/vnd.google-apps.presentation": { icon: Presentation, color: "text-orange-500 dark:text-orange-400", label: "Google Slides" },
  "application/pdf": { icon: FileText, color: "text-red-600 dark:text-red-400", label: "PDF" },
  "application/vnd.google-apps.form": { icon: FileText, color: "text-purple-600 dark:text-purple-400", label: "Google Form" },
}

function getFileConfig(mimeType: string) {
  if (FILE_TYPE_CONFIG[mimeType]) return FILE_TYPE_CONFIG[mimeType]
  if (mimeType.startsWith("image/")) return { icon: FileImage, color: "text-pink-600 dark:text-pink-400", label: "Image" }
  if (mimeType.startsWith("video/")) return { icon: Film, color: "text-red-500 dark:text-red-400", label: "Video" }
  if (mimeType.startsWith("audio/")) return { icon: Music, color: "text-indigo-600 dark:text-indigo-400", label: "Audio" }
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed"))
    return { icon: FileArchive, color: "text-amber-700 dark:text-amber-400", label: "Archive" }
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml") || mimeType.includes("html"))
    return { icon: FileCode, color: "text-emerald-600 dark:text-emerald-400", label: "Code" }
  return { icon: File, color: "text-gray-500 dark:text-gray-400", label: "File" }
}

export { getFileConfig }

function formatFileSize(bytes: string | undefined) {
  if (!bytes) return ""
  const size = parseInt(bytes, 10)
  if (isNaN(size)) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export { formatFileSize }

type FileCardProps = {
  file: DriveFile
  selected?: boolean
  view: "grid" | "list"
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDownload?: () => void
  onShare?: () => void
}

export function FileCard({
  file,
  selected,
  view,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDownload,
  onShare,
}: FileCardProps) {
  const config = getFileConfig(file.mimeType)
  const Icon = config.icon
  const isFolder = file.mimeType === "application/vnd.google-apps.folder"
  const modifiedAgo = file.modifiedTime
    ? formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })
    : ""

  if (view === "list") {
    return null // handled by file-browser table
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 transition-all duration-150 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 dark:hover:shadow-black/20",
        selected && "border-primary bg-primary/5 shadow-md ring-2 ring-primary/25"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!isFolder && onDownload && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Download ${file.name}`}
            onClick={(e) => { e.stopPropagation(); onDownload() }}
          >
            <Download />
          </Button>
        )}
        {onShare && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Share ${file.name}`}
            onClick={(e) => { e.stopPropagation(); onShare() }}
          >
            <Share2 />
          </Button>
        )}
      </div>

      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-xl",
        isFolder ? "bg-amber-50 dark:bg-amber-950/40" : "bg-muted/80"
      )}>
        <Icon className={cn("h-8 w-8", config.color)} />
      </div>

      <Tooltip>
        <TooltipTrigger className="w-full">
          <p className="w-full truncate text-center text-sm font-medium">{file.name}</p>
        </TooltipTrigger>
        <TooltipContent>{file.name}</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {modifiedAgo && <span>{modifiedAgo}</span>}
        {file.shared && (
          <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
            <Users className="h-2.5 w-2.5" />
            Shared
          </Badge>
        )}
      </div>
    </div>
  )
}
