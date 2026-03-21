"use client"

import { MessageCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import type { Chat } from "@/hooks/use-teams"

type ChatListProps = {
  chats: Chat[]
  selectedId: string | null
  onSelect: (chatId: string) => void
  loading?: boolean
  error?: string | null
}

function chatLabel(chat: Chat): string {
  if (chat.topic) return chat.topic
  if (chat.chatType === "oneOnOne") return "1:1 Chat"
  if (chat.chatType === "group") return "Group Chat"
  if (chat.chatType === "meeting") return "Meeting Chat"
  return "Chat"
}

function chatTypeBadge(chatType: string): string {
  switch (chatType) {
    case "oneOnOne":
      return "1:1"
    case "group":
      return "Group"
    case "meeting":
      return "Meeting"
    default:
      return chatType
  }
}

export function ChatList({ chats, selectedId, onSelect, loading, error }: ChatListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">No chats found</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <nav className="flex flex-col gap-0.5 p-2">
        {chats.map((chat) => {
          const isActive = selectedId === chat.id
          const label = chatLabel(chat)
          return (
            <button
              key={chat.id}
              onClick={() => onSelect(chat.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-150",
                "hover:bg-accent/60",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80"
              )}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn("text-[13px] font-medium truncate", isActive && "font-semibold")}>
                    {label}
                  </p>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                    {chatTypeBadge(chat.chatType)}
                  </Badge>
                </div>
                {chat.lastUpdatedDateTime && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {formatDistanceToNow(new Date(chat.lastUpdatedDateTime), { addSuffix: true })}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </nav>
    </ScrollArea>
  )
}
