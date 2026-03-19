"use client"

import { useCallback } from "react"
import {
  Star,
  Paperclip,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GmailMessage } from "@/hooks/use-gmail"
import { formatRelativeDate, getInitials, getAvatarColor, decodeHtmlEntities } from "./utils"

type MessageListProps = {
  messages: GmailMessage[]
  loading: boolean
  error?: string | null
  selectedId: string | null
  onSelect: (message: GmailMessage) => void
  onStarToggle: (message: GmailMessage) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onRetry?: () => void
}

export function MessageList({
  messages,
  loading,
  error,
  selectedId,
  onSelect,
  onStarToggle,
  selectedIds,
  onToggleSelect,
  onRetry,
}: MessageListProps) {
  const handleCheckbox = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      onToggleSelect(id)
    },
    [onToggleSelect]
  )

  const handleStar = useCallback(
    (e: React.MouseEvent, message: GmailMessage) => {
      e.stopPropagation()
      onStarToggle(message)
    },
    [onStarToggle]
  )

  if (loading) {
    return (
      <div className="flex flex-col p-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-[14px] rounded-sm shrink-0" />
            <Skeleton className="size-[14px] rounded-sm shrink-0" />
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-48 hidden sm:block" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full bg-muted/80 p-5">
          <svg
            className="size-10 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.039a2.25 2.25 0 012.134 0l7.5 4.039a2.25 2.25 0 011.183 1.98V19.5z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground/70">No messages</p>
        <p className="text-xs text-muted-foreground">
          Messages matching your criteria will appear here
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col">
        {messages.map((message) => {
          const isSelected = selectedId === message.id
          const isChecked = selectedIds.has(message.id)
          const initials = getInitials(message.from)
          const color = getAvatarColor(message.fromEmail || message.from)

          return (
            <div
              key={message.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(message)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(message)
                }
              }}
              className={cn(
                "flex items-center gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors duration-150 cursor-pointer",
                "hover:bg-accent/40",
                isSelected && "bg-primary/[0.07] border-l-2 border-l-primary",
                message.isUnread && !isSelected && "bg-blue-50/60 dark:bg-blue-950/20"
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onClick={(e) => handleCheckbox(e, message.id)}
                onChange={() => {}}
                className="size-[14px] rounded border-muted-foreground/40 accent-primary cursor-pointer shrink-0"
              />

              <button
                onClick={(e) => handleStar(e, message)}
                className={cn(
                  "shrink-0 transition-all duration-150",
                  message.isStarred
                    ? "text-yellow-400 hover:text-yellow-500 scale-100 hover:scale-110"
                    : "text-muted-foreground/30 hover:text-yellow-400"
                )}
              >
                <Star
                  className="size-[16px]"
                  fill={message.isStarred ? "currentColor" : "none"}
                />
              </button>

              <Avatar size="sm">
                <AvatarFallback
                  className="text-[10px] text-white font-semibold"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-[14px] leading-tight",
                      message.isUnread ? "font-semibold text-foreground" : "font-normal text-foreground/80"
                    )}
                  >
                    {message.from}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "truncate text-[13px] leading-snug",
                      message.isUnread
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {decodeHtmlEntities(message.subject || "(no subject)")}
                  </span>
                  <span className="text-[13px] text-muted-foreground/50 truncate hidden sm:inline">
                    &mdash; {decodeHtmlEntities(message.snippet || "")}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 ml-2">
                <span
                  className={cn(
                    "text-[12px] whitespace-nowrap",
                    message.isUnread
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {formatRelativeDate(message.date)}
                </span>
                {message.hasAttachment && (
                  <Paperclip className="size-3 text-muted-foreground/60" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
