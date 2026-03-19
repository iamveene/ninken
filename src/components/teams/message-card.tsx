"use client"

import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ChannelMessage } from "@/hooks/use-teams"

type MessageCardProps = {
  message: ChannelMessage
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

export function MessageCard({ message }: MessageCardProps) {
  const senderName = message.from?.user?.displayName ?? "Unknown"
  const timestamp = message.createdDateTime
    ? formatDistanceToNow(new Date(message.createdDateTime), { addSuffix: true })
    : ""

  const isHtml = message.body.contentType === "html"

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
          <span className="text-[11px] text-muted-foreground shrink-0">{timestamp}</span>
        </div>
        {isHtml ? (
          <div
            className="mt-1 text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5 [&_br]:leading-tight"
            dangerouslySetInnerHTML={{ __html: message.body.content }}
          />
        ) : (
          <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
            {message.body.content}
          </p>
        )}
      </div>
    </div>
  )
}
