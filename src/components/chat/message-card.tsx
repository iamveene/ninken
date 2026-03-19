"use client"

import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Paperclip } from "lucide-react"
import type { ChatMessage } from "@/hooks/use-chat"

type MessageCardProps = {
  message: ChatMessage
  onThreadClick?: (threadName: string) => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500/20 text-blue-500",
    "bg-green-500/20 text-green-500",
    "bg-purple-500/20 text-purple-500",
    "bg-orange-500/20 text-orange-500",
    "bg-pink-500/20 text-pink-500",
    "bg-cyan-500/20 text-cyan-500",
    "bg-amber-500/20 text-amber-500",
    "bg-rose-500/20 text-rose-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function MessageCard({ message, onThreadClick }: MessageCardProps) {
  const senderName = message.sender?.displayName ?? "Unknown"
  const senderType = message.sender?.type ?? ""
  const timestamp = message.createTime
    ? formatDistanceToNow(new Date(message.createTime), { addSuffix: true })
    : ""

  const hasAttachments = message.attachment.length > 0

  return (
    <div className="flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className={getAvatarColor(senderName)}>
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold truncate">{senderName}</span>
          {senderType === "BOT" && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              BOT
            </span>
          )}
          <span className="text-[11px] text-muted-foreground shrink-0">{timestamp}</span>
        </div>
        {message.formattedText ? (
          <div
            className="mt-1 text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5 [&_br]:leading-tight"
            dangerouslySetInnerHTML={{ __html: message.formattedText }}
          />
        ) : (
          <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
            {message.text}
          </p>
        )}
        {hasAttachments && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.attachment.map((att) => (
              <span
                key={att.name}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground"
              >
                <Paperclip className="h-3 w-3" />
                {att.contentName || "Attachment"}
              </span>
            ))}
          </div>
        )}
        {message.threadName && onThreadClick && (
          <button
            onClick={() => onThreadClick(message.threadName)}
            className="mt-1.5 text-xs text-primary hover:underline"
          >
            View thread
          </button>
        )}
      </div>
    </div>
  )
}
