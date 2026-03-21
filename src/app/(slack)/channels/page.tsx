"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { ResizablePanel, PanelGroup, ResizeHandle } from "@/components/ui/resize-handle"
import { SidebarSlotContent } from "@/components/sidebar-slot"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Hash,
  Lock,
  Search,
  MessageSquare,
  Users,
  Archive,
  ChevronLeft,
} from "lucide-react"
import { useSlackChannels, useSlackMessages } from "@/hooks/use-slack"
import type { SlackChannel, SlackMessage } from "@/hooks/use-slack"
import { useIsMobile } from "@/hooks/use-mobile"

export default function ChannelsPageWrapper() {
  return (
    <Suspense>
      <ChannelsPage />
    </Suspense>
  )
}

function ChannelsSidebar({
  channels,
  activeChannelId,
  onSelect,
  loading,
}: {
  channels: SlackChannel[]
  activeChannelId: string | null
  onSelect: (ch: SlackChannel) => void
  loading: boolean
}) {
  const [filter, setFilter] = useState("")

  const filtered = filter
    ? channels.filter((ch) =>
        ch.name.toLowerCase().includes(filter.toLowerCase())
      )
    : channels

  return (
    <div className="flex flex-col gap-1">
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter channels..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      {loading ? (
        <div className="space-y-1 px-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        filtered.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors w-full text-left",
              activeChannelId === ch.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {ch.isPrivate ? (
              <Lock className="h-3.5 w-3.5 shrink-0" />
            ) : ch.isIm || ch.isMpim ? (
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            ) : ch.isArchived ? (
              <Archive className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Hash className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{ch.name}</span>
            {ch.memberCount > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {ch.memberCount}
              </span>
            )}
          </button>
        ))
      )}
      {!loading && filtered.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">No channels found</p>
      )}
    </div>
  )
}

function formatSlackTs(ts: string): string {
  const date = new Date(parseFloat(ts) * 1000)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MessageItem({ message }: { message: SlackMessage }) {
  return (
    <div className="border-b border-border/40 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
          {message.user?.slice(0, 2) || "??"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{message.user || "system"}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatSlackTs(message.ts)}
            </span>
          </div>
          <p className="text-xs text-foreground/80 mt-0.5 whitespace-pre-wrap break-words">
            {message.text}
          </p>
          {message.replyCount > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <MessageSquare className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] text-blue-500">
                {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
              </span>
            </div>
          )}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.reactions.map((r) => (
                <Badge key={r.name} variant="secondary" className="text-[10px] px-1.5 py-0">
                  :{r.name}: {r.count}
                </Badge>
              ))}
            </div>
          )}
          {message.hasAttachments && (
            <Badge variant="outline" className="mt-1 text-[10px]">
              Has attachments
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function ChannelsPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get("view") || "all"

  const { channels, loading: channelsLoading } = useSlackChannels(viewParam)
  const [activeChannel, setActiveChannel] = useState<SlackChannel | null>(null)
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useSlackMessages(activeChannel?.id ?? null)

  const handleSelectChannel = useCallback(
    (ch: SlackChannel) => {
      setActiveChannel(ch)
      if (isMobile) setMobileView("detail")
    },
    [isMobile]
  )

  const handleBack = useCallback(() => {
    setActiveChannel(null)
    if (isMobile) setMobileView("list")
  }, [isMobile])

  // Reset selection when view changes
  useEffect(() => {
    setActiveChannel(null)
    if (isMobile) setMobileView("list")
  }, [viewParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Channel list in sidebar
  const channelListContent = (
    <SidebarSlotContent>
      <ChannelsSidebar
        channels={channels}
        activeChannelId={activeChannel?.id ?? null}
        onSelect={handleSelectChannel}
        loading={channelsLoading}
      />
    </SidebarSlotContent>
  )

  // Messages panel
  const messagesContent = (
    <div className="flex flex-col h-full min-w-0">
      {activeChannel ? (
        <>
          <div className="flex items-center gap-2 border-b px-4 py-2">
            {isMobile && (
              <button onClick={handleBack} className="p-1">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {activeChannel.isPrivate ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{activeChannel.name}</span>
            <div className="ml-auto flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {activeChannel.memberCount}
              </span>
            </div>
          </div>
          {activeChannel.topic && (
            <div className="border-b px-4 py-1.5 bg-muted/30">
              <p className="text-[10px] text-muted-foreground truncate">
                {activeChannel.topic}
              </p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {messagesLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : messagesError ? (
              <div className="p-4">
                <Card className="p-4">
                  <p className="text-xs text-red-500">{messagesError}</p>
                  <button
                    onClick={() => refetchMessages()}
                    className="mt-2 text-xs text-primary underline"
                  >
                    Retry
                  </button>
                </Card>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">No messages</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem key={msg.ts} message={msg} />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Hash className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Select a channel to view messages
            </p>
          </div>
        </div>
      )}
    </div>
  )

  const showMobileList = !isMobile || mobileView === "list"
  const showMobileDetail = !isMobile || mobileView === "detail"

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background">
      {channelListContent}

      {isMobile ? (
        <>
          {showMobileList && (
            <div className="flex flex-col h-full w-full">
              <div className="p-4">
                <h1 className="text-lg font-semibold">Channels</h1>
                <p className="text-xs text-muted-foreground">
                  {channels.length} channels
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-2">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChannel(ch)}
                    className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {ch.isPrivate ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Hash className="h-4 w-4" />
                    )}
                    <span>{ch.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {ch.memberCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {showMobileDetail && messagesContent}
        </>
      ) : activeChannel ? (
        <PanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel id="ch-list" defaultSize="300px" minSize="200px">
            <div className="flex flex-col h-full overflow-y-auto border-r p-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs w-full text-left transition-colors",
                    activeChannel?.id === ch.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {ch.isPrivate ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </ResizablePanel>
          <ResizeHandle />
          <ResizablePanel id="ch-msgs" defaultSize="1fr" minSize="300px">
            {messagesContent}
          </ResizablePanel>
        </PanelGroup>
      ) : (
        messagesContent
      )}
    </div>
  )
}
