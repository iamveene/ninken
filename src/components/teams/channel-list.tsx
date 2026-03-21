"use client"

import { Hash, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { Channel } from "@/hooks/use-teams"

type ChannelListProps = {
  channels: Channel[]
  selectedId: string | null
  onSelect: (channelId: string) => void
  loading?: boolean
  teamName?: string
}

export function ChannelList({
  channels,
  selectedId,
  onSelect,
  loading,
  teamName,
}: ChannelListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {teamName && (
        <div className="px-3 py-2.5 border-b">
          <h3 className="text-sm font-semibold truncate">{teamName}</h3>
        </div>
      )}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2">
          {channels.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              No channels found
            </p>
          ) : (
            channels.map((channel) => {
              const isActive = selectedId === channel.id
              const isPrivate = channel.membershipType === "private"
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelect(channel.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                    "hover:bg-accent/60",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground/80"
                  )}
                >
                  {isPrivate ? (
                    <Lock className={cn("size-4 shrink-0", isActive && "text-primary")} />
                  ) : (
                    <Hash className={cn("size-4 shrink-0", isActive && "text-primary")} />
                  )}
                  <span className="flex-1 truncate text-left">{channel.displayName}</span>
                </button>
              )
            })
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}
