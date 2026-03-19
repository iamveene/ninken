"use client"

import { useState, useCallback } from "react"
import { Panel, Group as PanelGroup } from "react-resizable-panels"
import { cn } from "@/lib/utils"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { LabelSidebar } from "@/components/gmail/label-sidebar"
import { MessageList } from "@/components/gmail/message-list"
import { MessageView } from "@/components/gmail/message-view"
import { ThreadView } from "@/components/gmail/thread-view"
import { ComposeDialog } from "@/components/gmail/compose-dialog"
import { SearchBar } from "@/components/gmail/search-bar"
import { SearchFilters } from "@/components/gmail/search-filters"
import { Toolbar } from "@/components/gmail/toolbar"
import {
  useMessages,
  useMessage,
  useThread,
  useLabels,
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

export default function GmailPage() {
  const isMobile = useIsMobile()

  const [activeLabel, setActiveLabel] = useState("INBOX")
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

  const effectiveQuery = searchQuery || LABEL_QUERIES[activeLabel] || `label:${activeLabel}`
  const { data: messages, loading: messagesLoading, error: messagesError, totalEstimate, nextPageToken, refetch } = useMessages(effectiveQuery)
  const { data: selectedMessage, loading: messageLoading, error: messageError } = useMessage(selectedMessageId)
  const { data: thread, loading: threadLoading } = useThread(showThread ? selectedThreadId : null)
  const { data: labels, loading: labelsLoading } = useLabels()
  const { trash } = useTrashMessage()
  const { modify } = useModifyLabels()

  const handleLabelChange = useCallback((labelId: string) => {
    setActiveLabel(labelId)
    setSearchQuery("")
    setSelectedMessageId(null)
    setSelectedThreadId(null)
    setShowThread(false)
    setSelectedIds(new Set())
    if (isMobile) setMobileView("list")
  }, [isMobile])

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

  // Shared message list content
  const messageListContent = (
    <div className="flex flex-col h-full min-w-0 border-r border-border/60 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border/60">
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
          {Object.entries(LABEL_QUERIES).map(([id, _]) => (
            <button
              key={id}
              onClick={() => handleLabelChange(id)}
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
          <svg
            className="size-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
            />
          </svg>
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
        <PanelGroup orientation="horizontal" id="gmail-panels">
          <Panel defaultSize={12} minSize={8} maxSize={20}>
            <LabelSidebar
              labels={labels}
              activeLabel={activeLabel}
              onLabelChange={handleLabelChange}
              onCompose={handleCompose}
              loading={labelsLoading}
            />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={43} minSize={25}>
            {messageListContent}
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={45} minSize={20}>
            {detailContent}
          </Panel>
        </PanelGroup>
      ) : (
        <PanelGroup orientation="horizontal" id="gmail-expanded">
          <Panel defaultSize={15} minSize={10} maxSize={25}>
            <LabelSidebar
              labels={labels}
              activeLabel={activeLabel}
              onLabelChange={handleLabelChange}
              onCompose={handleCompose}
              loading={labelsLoading}
            />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={85} minSize={60}>
            {messageListContent}
          </Panel>
        </PanelGroup>
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
