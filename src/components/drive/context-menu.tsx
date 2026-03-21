"use client"

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  FolderOpen,
  Eye,
  Download,
  Pencil,
  FolderInput,
  Copy,
  Share2,
  Trash2,
  XCircle,
} from "lucide-react"
import type { DriveFile } from "@/hooks/use-drive"

type FileContextMenuProps = {
  file: DriveFile
  children: React.ReactNode
  triggerRender?: React.ReactElement
  onOpen?: () => void
  onDownload?: () => void
  onRename?: () => void
  onCopy?: () => void
  onShare?: () => void
  onTrash?: () => void
  onDelete?: () => void
}

export function FileContextMenu({
  file,
  children,
  triggerRender,
  onOpen,
  onDownload,
  onRename,
  onCopy,
  onShare,
  onTrash,
  onDelete,
}: FileContextMenuProps) {
  const isFolder = file.mimeType === "application/vnd.google-apps.folder"

  return (
    <ContextMenu>
      <ContextMenuTrigger {...(triggerRender ? { render: triggerRender } : {})}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onOpen && (
          <ContextMenuItem onClick={onOpen}>
            {isFolder ? <FolderOpen className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {isFolder ? "Open" : "Preview"}
          </ContextMenuItem>
        )}

        {!isFolder && onDownload && (
          <ContextMenuItem onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {onRename && (
          <ContextMenuItem onClick={onRename}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
        )}

        {onCopy && (
          <ContextMenuItem onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Make a copy
          </ContextMenuItem>
        )}

        {onShare && (
          <ContextMenuItem onClick={onShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {onTrash && (
          <ContextMenuItem onClick={onTrash}>
            <Trash2 className="mr-2 h-4 w-4" />
            Move to trash
          </ContextMenuItem>
        )}

        {onDelete && (
          <ContextMenuItem variant="destructive" onClick={onDelete}>
            <XCircle className="mr-2 h-4 w-4" />
            Delete permanently
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
