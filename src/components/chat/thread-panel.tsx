"use client"

import { X, MessageSquare, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { MessageCard } from "@/components/chat/message-card"
import type { ChatMessage } from "@/hooks/use-chat"

type ThreadPanelProps = {
  messages: ChatMessage[]
  threadName: string | null
  loading?: boolean
  onClose: () => void
}

export function ThreadPanel({ messages, threadName, loading, onClose }: ThreadPanelProps) {
  // Filter messages belonging to this thread
  const threadMessages = threadName
    ? messages.filter((m) => m.threadName === threadName)
    : []

  return (
    <div className="flex flex-col h-full border-l border-border/60">
      <div className="px-4 py-2.5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="text-sm font-semibold truncate">Thread</h3>
          {!loading && threadMessages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {threadMessages.length} {threadMessages.length === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading thread...
        </div>
      ) : threadMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center">
            No messages in this thread
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/40">
            {threadMessages.map((msg) => (
              <MessageCard key={msg.name} message={msg} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
