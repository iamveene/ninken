"use client"

import { formatDistanceToNow } from "date-fns"
import {
  Mail,
  FileText,
  HardDrive,
  MessageSquare,
  BookMarked,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RotateCcw,
  Loader2,
  FolderGit2,
  Building2,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { CollectionItem } from "@/lib/collection-store"

const TYPE_CONFIG: Record<CollectionItem["type"], { icon: typeof Mail; color: string; bg: string }> = {
  email: { icon: Mail, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
  file: { icon: FileText, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
  object: { icon: HardDrive, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
  "chat-message": { icon: MessageSquare, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40" },
  repo: { icon: BookMarked, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-950/40" },
  "audit-finding": { icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
  project: { icon: FolderGit2, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40" },
  group: { icon: Building2, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  snippet: { icon: FileCode, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
}

const STATUS_CONFIG = {
  pending: { icon: Clock, label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  downloading: { icon: Loader2, label: "Downloading", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  done: { icon: CheckCircle2, label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  error: { icon: AlertCircle, label: "Error", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

type CollectionItemCardProps = {
  item: CollectionItem
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

export function CollectionItemCard({ item, onRemove, onRetry }: CollectionItemCardProps) {
  const typeConfig = TYPE_CONFIG[item.type]
  const statusConfig = STATUS_CONFIG[item.status]
  const TypeIcon = typeConfig.icon
  const StatusIcon = statusConfig.icon

  const timeAgo = formatDistanceToNow(new Date(item.collectedAt), { addSuffix: true })

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 group">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          typeConfig.bg
        )}
      >
        <TypeIcon className={cn("size-5", typeConfig.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <Badge
            variant="secondary"
            className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0 border-0 gap-1", statusConfig.color)}
          >
            <StatusIcon
              className={cn(
                "size-3",
                item.status === "downloading" && "animate-spin"
              )}
            />
            {statusConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="capitalize">{item.source}</span>
          {item.subtitle && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="truncate">{item.subtitle}</span>
            </>
          )}
          {item.sizeBytes ? (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span>{formatBytes(item.sizeBytes)}</span>
            </>
          ) : null}
          <span className="text-muted-foreground/40">|</span>
          <span>{timeAgo}</span>
        </div>
        {item.error && (
          <p className="mt-1 text-xs text-destructive truncate">{item.error}</p>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === "error" && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onRetry(item.id)}
                  className="inline-flex items-center justify-center size-8 rounded-md hover:bg-accent transition-colors"
                />
              }
            >
              <RotateCcw className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Retry download</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="inline-flex items-center justify-center size-8 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
              />
            }
          >
            <Trash2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Remove from collection</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
