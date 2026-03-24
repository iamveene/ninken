"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ArrowLeft, Reply, Forward } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GmailThread, GmailMessage } from "@/hooks/use-gmail"
import { formatRelativeDate, getInitials, getAvatarColor, sanitizeHtml } from "./utils"

type ThreadViewProps = {
  thread: GmailThread | null
  loading: boolean
  onReply: (message: GmailMessage) => void
  onForward: (message: GmailMessage) => void
  onBack?: () => void
}

export function ThreadView({
  thread,
  loading,
  onReply,
  onForward,
  onBack,
}: ThreadViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-7 w-3/4 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!thread || !thread.messages.length) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">No thread selected</p>
      </div>
    )
  }

  const lastMessage = thread.messages[thread.messages.length - 1]
  const subject = lastMessage.subject || "(no subject)"

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isExpanded = (id: string, index: number) => {
    if (expandedIds.has(id)) return true
    return index === thread.messages.length - 1
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <h1 className="text-base font-semibold truncate flex-1">{subject}</h1>
        <span className="text-[12px] text-muted-foreground shrink-0 tabular-nums">
          {thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-4 max-w-3xl">
          {thread.messages.map((message, index) => {
            const expanded = isExpanded(message.id, index)
            const initials = getInitials(message.from)
            const color = getAvatarColor(message.fromEmail || message.from)

            return (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg border bg-card transition-shadow duration-150",
                  expanded && "shadow-sm"
                )}
              >
                <button
                  onClick={() => toggleExpand(message.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left",
                    "hover:bg-accent/40 transition-colors duration-150 rounded-lg"
                  )}
                >
                  {expanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <Avatar size="sm">
                    <AvatarFallback
                      className="text-[10px] text-white font-semibold"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-[14px] font-medium">{message.from}</span>
                    {!expanded && (
                      <span className="text-[13px] text-muted-foreground/60 ml-2 truncate">
                        {message.snippet}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-muted-foreground shrink-0">
                    {formatRelativeDate(message.date)}
                  </span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4">
                    <div className="pl-11 text-[12px] text-muted-foreground mb-3">
                      to {message.to}
                      {message.cc && <>, cc: {message.cc}</>}
                    </div>

                    <Separator className="mb-4" />

                    {message.htmlBody ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none break-words pl-2 [&_*]:leading-[1.6]"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(message.htmlBody),
                        }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-[14px] leading-[1.6] text-foreground/90 pl-2">
                        {message.body || message.snippet}
                      </div>
                    )}

                    <div className="mt-5 flex gap-2 pl-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReply(message)
                        }}
                      >
                        <Reply className="size-3.5" />
                        Reply
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          onForward(message)
                        }}
                      >
                        <Forward className="size-3.5" />
                        Forward
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
