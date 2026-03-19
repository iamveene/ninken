"use client"

import {
  Reply,
  Forward,
  Trash2,
  MailOpen,
  Archive,
  Tag,
  Download,
  FileIcon,
  ArrowLeft,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GmailMessage } from "@/hooks/use-gmail"
import { formatRelativeDate, getInitials, getAvatarColor, formatFileSize, sanitizeHtml } from "./utils"

const LABEL_COLORS: Record<string, string> = {
  INBOX: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  STARRED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  IMPORTANT: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  SENT: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  SPAM: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  TRASH: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
}

type MessageViewProps = {
  message: GmailMessage | null
  loading: boolean
  error?: string | null
  onReply: (message: GmailMessage) => void
  onForward: (message: GmailMessage) => void
  onTrash: (message: GmailMessage) => void
  onMarkUnread: (message: GmailMessage) => void
  onArchive: (message: GmailMessage) => void
  onBack?: () => void
}

export function MessageView({
  message,
  loading,
  error,
  onReply,
  onForward,
  onTrash,
  onMarkUnread,
  onArchive,
  onBack,
}: MessageViewProps) {
  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="space-y-3">
          <Skeleton className="h-7 w-3/4 rounded" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!message) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-muted/60">
            <svg
              className="size-10 text-muted-foreground/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Select a message to read
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Choose from the list on the left
          </p>
        </div>
      </div>
    )
  }

  const initials = getInitials(message.from)
  const color = getAvatarColor(message.fromEmail || message.from)

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onReply(message)}
            title="Reply"
            className="hover:bg-accent"
          >
            <Reply className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onForward(message)}
            title="Forward"
            className="hover:bg-accent"
          >
            <Forward className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onArchive(message)}
            title="Archive"
            className="hover:bg-accent"
          >
            <Archive className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onTrash(message)}
            title="Trash"
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMarkUnread(message)}
            title="Mark unread"
            className="hover:bg-accent"
          >
            <MailOpen className="size-[18px]" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Label" className="hover:bg-accent">
            <Tag className="size-[18px]" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl">
          <h1 className="text-xl font-semibold leading-tight text-foreground">
            {message.subject || "(no subject)"}
          </h1>

          {message.labelIds && message.labelIds.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {message.labelIds
                .filter((l) => !["UNREAD", "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS"].includes(l))
                .map((label) => {
                  const colorClass = LABEL_COLORS[label] || "bg-muted text-muted-foreground"
                  const displayName = label.replace(/^CATEGORY_/, "").toLowerCase()
                  return (
                    <Badge
                      key={label}
                      variant="secondary"
                      className={`text-[10px] font-medium px-2 py-0.5 border-0 ${colorClass}`}
                    >
                      {displayName}
                    </Badge>
                  )
                })}
            </div>
          )}

          <div className="mt-5 flex items-start gap-3">
            <Avatar>
              <AvatarFallback
                className="text-sm text-white font-semibold"
                style={{ backgroundColor: color }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-[14px]">{message.from}</span>
                <span className="text-[12px] text-muted-foreground">
                  {formatRelativeDate(message.date)}
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                to {message.to}
                {message.cc && <>, cc: {message.cc}</>}
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          {message.htmlBody ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none break-words [&_*]:leading-[1.6]"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(message.htmlBody),
              }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-[14px] leading-[1.6] text-foreground/90">
              {message.body || message.snippet}
            </div>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="text-[13px] font-semibold text-foreground/80 mb-3">
                  Attachments ({message.attachments.length})
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {message.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-accent/40 transition-colors duration-150 group"
                    >
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                        <FileIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {att.filename}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatFileSize(att.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          window.open(
                            `/api/gmail/messages/${message.id}/attachments/${att.id}`,
                            "_blank"
                          )
                        }}
                        title="Download"
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Quick reply/forward bar at bottom */}
          <div className="mt-8 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onReply(message)}
            >
              <Reply className="size-3.5" />
              Reply
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onForward(message)}
            >
              <Forward className="size-3.5" />
              Forward
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
