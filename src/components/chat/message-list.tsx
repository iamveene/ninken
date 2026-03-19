"use client"

import { MessageSquare, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCard } from "@/components/chat/message-card"
import type { ChatMessage } from "@/hooks/use-chat"

type MessageListProps = {
  messages: ChatMessage[]
  loading?: boolean
  spaceName?: string
  onThreadClick?: (threadName: string) => void
}

export function MessageList({ messages, loading, spaceName, onThreadClick }: MessageListProps) {
  return (
    <div className="flex flex-col h-full">
      {spaceName && (
        <div className="px-4 py-2.5 border-b flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{spaceName}</h3>
          <span className="text-xs text-muted-foreground">
            {!loading && `${messages.length} messages`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading messages...
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center">
            {spaceName ? "No messages in this space" : "Select a space to view messages"}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/40">
            {messages.map((msg) => (
              <MessageCard key={msg.name} message={msg} onThreadClick={onThreadClick} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
