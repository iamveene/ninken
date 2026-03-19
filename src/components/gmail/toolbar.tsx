"use client"

import {
  RefreshCw,
  Mail,
  MailOpen,
  Trash2,
  Tag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ToolbarProps = {
  selectedCount: number
  totalMessages: number
  onSelectAll: () => void
  onDeselectAll: () => void
  allSelected: boolean
  onRefresh: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onTrash: () => void
  onNextPage?: () => void
  onPrevPage?: () => void
  hasNextPage: boolean
  hasPrevPage: boolean
  pageInfo?: string
}

export function Toolbar({
  selectedCount,
  totalMessages,
  onSelectAll,
  onDeselectAll,
  allSelected,
  onRefresh,
  onMarkRead,
  onMarkUnread,
  onTrash,
  onNextPage,
  onPrevPage,
  hasNextPage,
  hasPrevPage,
  pageInfo,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border/60 px-3 py-1.5 bg-muted/20">
      <input
        type="checkbox"
        checked={allSelected && totalMessages > 0}
        onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
        className="size-[14px] rounded border-muted-foreground/40 accent-primary cursor-pointer"
      />

      <Button variant="ghost" size="icon-xs" onClick={onRefresh} title="Refresh" className="hover:bg-accent">
        <RefreshCw className="size-[15px]" />
      </Button>

      {selectedCount > 0 && (
        <>
          <div className="h-4 w-px bg-border mx-0.5" />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onMarkRead}
            title="Mark as read"
            className="hover:bg-accent"
          >
            <MailOpen className="size-[15px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onMarkUnread}
            title="Mark as unread"
            className="hover:bg-accent"
          >
            <Mail className="size-[15px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onTrash}
            title="Trash"
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-[15px]" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-xs" title="Label" className="hover:bg-accent" />
              }
            >
              <Tag className="size-[15px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Inbox</DropdownMenuItem>
              <DropdownMenuItem>Starred</DropdownMenuItem>
              <DropdownMenuItem>Important</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="ml-1 text-[11px] text-muted-foreground">
            {selectedCount} selected
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground tabular-nums">
        {pageInfo && <span>{pageInfo}</span>}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onPrevPage}
          disabled={!hasPrevPage}
        >
          <ChevronLeft className="size-[15px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onNextPage}
          disabled={!hasNextPage}
        >
          <ChevronRight className="size-[15px]" />
        </Button>
      </div>
    </div>
  )
}
