"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { ResizablePanel, PanelGroup, ResizeHandle } from "@/components/ui/resize-handle"
import { MessageList } from "@/components/gmail/message-list"
import { MessageView } from "@/components/gmail/message-view"
import { ThreadView } from "@/components/gmail/thread-view"
import { ComposeDialog } from "@/components/gmail/compose-dialog"
import { SearchBar } from "@/components/gmail/search-bar"
import { SearchFilters } from "@/components/gmail/search-filters"
import { Toolbar } from "@/components/gmail/toolbar"
import { Button } from "@/components/ui/button"
import { PenLine } from "lucide-react"
import {
  useMessages,
  useMessage,
  useThread,
  useTrashMessage,
  useModifyLabels,
} from "@/hooks/use-gmail"
import type { GmailMessage } from "@/hooks/use-gmail"
import { useIsMobile } from "@/hooks/use-mobile"

const LABEL_QUERIES: Record<string, string> = {
  INBOX: "in:inbox",
  STARRED: "is:starred",
  SENT: "in:sent",
  DRAFT: "in:drafts",
  IMPORTANT: "is:important",
  SPAM: "in:spam",
  TRASH: "in:trash",
}

type ComposeState = {
  open: boolean
  mode: "new" | "reply" | "forward"
  prefill?: {
    to?: string
    cc?: string
    subject?: string
    body?: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }
}

export default function GmailPageWrapper() {
  return (
    <Suspense>
      <GmailPage />
    </Suspense>
  )
}

function GmailPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()

  // Read active label from URL search params (set by sidebar sub-nav)
  const labelFromUrl = searchParams.get("label")
  const [activeLabel, setActiveLabel] = useState(labelFromUrl || "INBOX")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showThread, setShowThread] = useState(false)
  const [compose, setCompose] = useState<ComposeState>({
    open: false,
    mode: "new",
  })
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  // Sync label from URL when sidebar nav changes
  useEffect(() => {
    if (labelFromUrl && labelFromUrl !== activeLabel) {
      setActiveLabel(labelFromUrl)
      setSearchQuery("")
      setSelectedMessageId(null)
      setSelectedThreadId(null)
      setShowThread(false)
      setSelectedIds(new Set())
    }
  }, [labelFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveQuery = searchQuery || LABEL_QUERIES[activeLabel] || `label:${activeLabel}`
  const { data: messages, loading: messagesLoading, error: messagesError, totalEstimate, nextPageToken, refetch } = useMessages(effectiveQuery)
  const { data: selectedMessage, loading: messageLoading, error: messageError } = useMessage(selectedMessageId)
  const { data: thread, loading: threadLoading } = useThread(showThread ? selectedThreadId : null)
  const { trash } = useTrashMessage()
  const { modify } = useModifyLabels()

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setSelectedMessageId(null)
    setSelectedThreadId(null)
    setShowThread(false)
    if (isMobile) setMobileView("list")
  }, [isMobile])

  const handleSelectMessage = useCallback((message: GmailMessage) => {
    setSelectedMessageId(message.id)
    setSelectedThreadId(message.threadId)
    setShowThread(false)
    if (isMobile) setMobileView("detail")
  }, [isMobile])

  const handleStarToggle = useCallback(async (message: GmailMessage) => {
    if (message.isStarred) {
      await modify(message.id, [], ["STARRED"])
    } else {
      await modify(message.id, ["STARRED"], [])
    }
    refetch()
  }, [modify, refetch])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(messages.map((m) => m.id)))
  }, [messages])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleTrash = useCallback(async (message: GmailMessage) => {
    await trash(message.id)
    setSelectedMessageId(null)
    refetch()
  }, [trash, refetch])

  const handleBulkTrash = useCallback(async () => {
    await Promise.all(Array.from(selectedIds).map((id) => trash(id)))
    setSelectedIds(new Set())
    setSelectedMessageId(null)
    refetch()
  }, [selectedIds, trash, refetch])

  const handleMarkRead = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map((id) => modify(id, [], ["UNREAD"]))
    )
    setSelectedIds(new Set())
    refetch()
  }, [selectedIds, modify, refetch])

  const handleMarkUnread = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map((id) => modify(id, ["UNREAD"], []))
    )
    setSelectedIds(new Set())
    refetch()
  }, [selectedIds, modify, refetch])

  const handleMarkSingleUnread = useCallback(async (message: GmailMessage) => {
    await modify(message.id, ["UNREAD"], [])
    setSelectedMessageId(null)
    refetch()
  }, [modify, refetch])

  const handleArchive = useCallback(async (message: GmailMessage) => {
    await modify(message.id, [], ["INBOX"])
    setSelectedMessageId(null)
    refetch()
  }, [modify, refetch])

  const handleCompose = useCallback(() => {
    setCompose({ open: true, mode: "new" })
  }, [])

  const handleReply = useCallback((message: GmailMessage) => {
    setCompose({
      open: true,
      mode: "reply",
      prefill: {
        to: message.fromEmail || message.from,
        subject: message.subject?.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
        threadId: message.threadId,
      },
    })
  }, [])

  const handleForward = useCallback((message: GmailMessage) => {
    setCompose({
      open: true,
      mode: "forward",
      prefill: {
        subject: message.subject?.startsWith("Fwd:") ? message.subject : `Fwd: ${message.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${message.from}\nDate: ${message.date}\nSubject: ${message.subject}\n\n${message.body || message.snippet}`,
      },
    })
  }, [])

  const handleBack = useCallback(() => {
    setSelectedMessageId(null)
    setSelectedThreadId(null)
    setShowThread(false)
    if (isMobile) setMobileView("list")
  }, [isMobile])

  const allSelected = messages.length > 0 && selectedIds.size === messages.length

  const showMobileList = !isMobile || mobileView === "list"
  const showMobileDetail = !isMobile || mobileView === "detail"

  // Message list content (no internal label sidebar — handled by main sidebar)
  const messageListContent = (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      {/* Compose button + Search */}
      <div className="flex items-center gap-2 p-3 border-b border-border/60">
        <Button size="sm" onClick={handleCompose} className="shrink-0">
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          Compose
        </Button>
        <div className="flex-1">
          <SearchBar
            onSearch={handleSearch}
            resultCount={searchQuery ? totalEstimate : undefined}
            currentQuery={searchQuery}
          />
        </div>
        <SearchFilters onApply={handleSearch} />
      </div>

      {isMobile && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b overflow-x-auto">
          {Object.entries(LABEL_QUERIES).map(([id]) => (
            <button
              key={id}
              onClick={() => setActiveLabel(id)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors",
                activeLabel === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {id.charAt(0) + id.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <Toolbar
        selectedCount={selectedIds.size}
        totalMessages={messages.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        allSelected={allSelected}
        onRefresh={() => refetch()}
        onMarkRead={handleMarkRead}
        onMarkUnread={handleMarkUnread}
        onTrash={handleBulkTrash}
        hasNextPage={!!nextPageToken}
        hasPrevPage={false}
        pageInfo={totalEstimate > 0 ? `1-${messages.length} of ${totalEstimate.toLocaleString()}` : undefined}
      />

      <MessageList
        messages={messages}
        loading={messagesLoading}
        error={messagesError}
        selectedId={selectedMessageId}
        onSelect={handleSelectMessage}
        onStarToggle={handleStarToggle}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onRetry={() => refetch()}
      />

      {isMobile && (
        <button
          onClick={handleCompose}
          className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <PenLine className="size-6" />
        </button>
      )}
    </div>
  )

  // Detail panel content
  const detailContent = (
    <div className="flex flex-1 flex-col min-w-0 h-full">
      {showThread && thread ? (
        <ThreadView
          thread={thread}
          loading={threadLoading}
          onReply={handleReply}
          onForward={handleForward}
          onBack={handleBack}
        />
      ) : (
        <MessageView
          message={selectedMessage}
          loading={messageLoading}
          error={messageError}
          onReply={handleReply}
          onForward={handleForward}
          onTrash={handleTrash}
          onMarkUnread={handleMarkSingleUnread}
          onArchive={handleArchive}
          onBack={handleBack}
        />
      )}
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background">
      {isMobile ? (
        <>
          {showMobileList && messageListContent}
          {showMobileDetail && detailContent}
        </>
      ) : selectedMessageId ? (
        <PanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel id="gm" defaultSize="400px" minSize="300px">
            {messageListContent}
          </ResizablePanel>
          <ResizeHandle />
          <ResizablePanel id="gd" defaultSize="1fr" minSize="300px">
            {detailContent}
          </ResizablePanel>
        </PanelGroup>
      ) : (
        messageListContent
      )}

      <ComposeDialog
        open={compose.open}
        onOpenChange={(open) => setCompose((prev) => ({ ...prev, open }))}
        mode={compose.mode}
        prefill={compose.prefill}
        onSent={() => refetch()}
      />
    </div>
  )
}
