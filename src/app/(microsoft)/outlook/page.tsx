"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { ResizablePanel, PanelGroup, ResizeHandle } from "@/components/ui/resize-handle"
import { FolderSidebar } from "@/components/outlook/folder-sidebar"
import { SidebarSlotContent } from "@/components/sidebar-slot"
import {
  useOutlookMessages,
  useOutlookMessage,
  useOutlookFolders,
  useSendOutlookMessage,
  useTrashOutlookMessage,
  useModifyOutlookMessage,
} from "@/hooks/use-outlook"
import type { OutlookMessage } from "@/hooks/use-outlook"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatDistanceToNow } from "date-fns"
import { Search, Loader2, Mail, Paperclip, Star, ArrowLeft, Reply, Forward, Trash2, MailOpen, X, PenLine } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { CollectButton } from "@/components/collection/collect-button"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
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
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

type ComposeState = {
  open: boolean
  mode: "new" | "reply" | "forward"
  prefill?: { to?: string; cc?: string; subject?: string; body?: string; conversationId?: string }
}

export default function OutlookPageWrapper() {
  return (
    <Suspense>
      <OutlookPage />
    </Suspense>
  )
}

function OutlookPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const folderFromUrl = searchParams.get("folder")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")
  const [compose, setCompose] = useState<ComposeState>({ open: false, mode: "new" })

  // Form state for compose
  const [composeTo, setComposeTo] = useState("")
  const [composeCc, setComposeCc] = useState("")
  const [composeSubject, setComposeSubject] = useState("")
  const [composeBody, setComposeBody] = useState("")

  const { folders, loading: foldersLoading } = useOutlookFolders()
  const { messages, loading: messagesLoading, error: messagesError, refetch } = useOutlookMessages(activeFolderId || undefined)
  const { message: selectedMessage, loading: messageLoading, error: messageError } = useOutlookMessage(selectedMessageId)
  const { send, loading: sendLoading } = useSendOutlookMessage()
  const { trash } = useTrashOutlookMessage()
  const { modify } = useModifyOutlookMessage()

  // Sync folder from URL when sidebar nav changes
  useEffect(() => {
    if (folderFromUrl && folders.length > 0) {
      const matchedFolder = folders.find(
        (f) => f.displayName.toLowerCase() === folderFromUrl.toLowerCase()
      )
      if (matchedFolder && matchedFolder.id !== activeFolderId) {
        setActiveFolderId(matchedFolder.id)
        setSelectedMessageId(null)
        setSearchQuery("")
      }
    }
  }, [folderFromUrl, folders]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select Inbox on first load
  const effectiveFolderId = activeFolderId || folders.find((f) => f.displayName.toLowerCase() === "inbox")?.id || null

  const handleFolderChange = useCallback((folderId: string) => {
    setActiveFolderId(folderId)
    setSelectedMessageId(null)
    setSearchQuery("")
    if (isMobile) setMobileView("list")
  }, [isMobile])

  const handleSelectMessage = useCallback((msg: OutlookMessage) => {
    setSelectedMessageId(msg.id)
    if (isMobile) setMobileView("detail")
  }, [isMobile])

  const handleBack = useCallback(() => {
    setSelectedMessageId(null)
    if (isMobile) setMobileView("list")
  }, [isMobile])

  const handleTrash = useCallback(async (msg: OutlookMessage) => {
    await trash(msg.id)
    setSelectedMessageId(null)
    refetch()
  }, [trash, refetch])

  const handleMarkUnread = useCallback(async (msg: OutlookMessage) => {
    await modify(msg.id, { isRead: false })
    setSelectedMessageId(null)
    refetch()
  }, [modify, refetch])

  const handleCompose = useCallback(() => {
    setComposeTo("")
    setComposeCc("")
    setComposeSubject("")
    setComposeBody("")
    setCompose({ open: true, mode: "new" })
  }, [])

  const handleReply = useCallback((msg: OutlookMessage) => {
    const fromAddr = msg.from?.emailAddress?.address || ""
    setComposeTo(fromAddr)
    setComposeCc("")
    setComposeSubject(msg.subject?.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`)
    setComposeBody("")
    setCompose({ open: true, mode: "reply", prefill: { conversationId: msg.conversationId } })
  }, [])

  const handleForward = useCallback((msg: OutlookMessage) => {
    const body = msg.body?.content || msg.bodyPreview || ""
    const fromName = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || ""
    setComposeTo("")
    setComposeCc("")
    setComposeSubject(msg.subject?.startsWith("Fwd:") ? msg.subject : `Fwd: ${msg.subject}`)
    setComposeBody(`\n\n---------- Forwarded message ----------\nFrom: ${fromName}\nDate: ${msg.receivedDateTime}\nSubject: ${msg.subject}\n\n${body}`)
    setCompose({ open: true, mode: "forward" })
  }, [])

  const handleSend = useCallback(async () => {
    await send({
      to: composeTo,
      cc: composeCc || undefined,
      subject: composeSubject,
      body: composeBody,
      conversationId: compose.prefill?.conversationId,
    })
    setCompose({ open: false, mode: "new" })
    refetch()
  }, [send, composeTo, composeCc, composeSubject, composeBody, compose.prefill, refetch])

  const filteredMessages = searchQuery
    ? messages.filter(
        (m) =>
          m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.bodyPreview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.from?.emailAddress?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.from?.emailAddress?.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const showMobileList = !isMobile || mobileView === "list"
  const showMobileDetail = !isMobile || mobileView === "detail"

  // Message list panel
  const messageListContent = (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border/60">
        <Button size="sm" onClick={handleCompose} className="shrink-0">
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          Compose
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="pl-9"
          />
        </div>
      </div>

      {isMobile && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b overflow-x-auto">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => handleFolderChange(folder.id)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors",
                (effectiveFolderId === folder.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {folder.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 border-b text-xs text-muted-foreground">
        <span>{filteredMessages.length} messages</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {messagesLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messagesError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
            <Mail className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-destructive">{messagesError}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
            <Mail className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No messages</p>
          </div>
        ) : (
          <div>
            {filteredMessages.map((msg) => {
              const senderName = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown"
              const isActive = selectedMessageId === msg.id
              return (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/30",
                    "hover:bg-muted/50",
                    isActive && "bg-primary/8",
                    !msg.isRead && "bg-accent/30"
                  )}
                >
                  <Avatar className="size-8 shrink-0 mt-0.5">
                    <AvatarFallback className={cn("text-[10px]", getAvatarColor(senderName))}>
                      {getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[13px] truncate", !msg.isRead ? "font-semibold" : "font-medium")}>
                        {senderName}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                        {msg.receivedDateTime
                          ? formatDistanceToNow(new Date(msg.receivedDateTime), { addSuffix: true })
                          : ""}
                      </span>
                    </div>
                    <p className={cn("text-[12.5px] truncate", !msg.isRead ? "font-medium text-foreground" : "text-foreground/80")}>
                      {msg.subject || "(No subject)"}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {msg.bodyPreview}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {msg.hasAttachments && (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                      {msg.importance === "high" && (
                        <Badge variant="destructive" className="h-4 text-[9px] px-1">High</Badge>
                      )}
                      {msg.flag?.flagStatus === "flagged" && (
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {isMobile && (
        <button
          onClick={handleCompose}
          className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Mail className="size-6" />
        </button>
      )}
    </div>
  )

  // Detail panel
  const detailContent = (
    <div className="flex flex-1 flex-col min-w-0 h-full">
      {messageLoading || (selectedMessageId && !selectedMessage && !messageError) ? (
        <div className="p-6 space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : messageError ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Mail className="h-8 w-8 text-destructive/50" />
          <p className="text-sm text-destructive">{messageError}</p>
        </div>
      ) : !selectedMessage ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Mail className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Select a message to read</p>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="ghost" size="icon" onClick={() => handleReply(selectedMessage)} title="Reply">
                <Reply className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleForward(selectedMessage)} title="Forward">
                <Forward className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleMarkUnread(selectedMessage)} title="Mark unread">
                <MailOpen className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleTrash(selectedMessage)} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
              <CollectButton
                params={{
                  type: "email",
                  source: "outlook",
                  title: selectedMessage.subject || "(No subject)",
                  subtitle: selectedMessage.from?.emailAddress?.address || selectedMessage.from?.emailAddress?.name || "",
                  sourceId: selectedMessage.id,
                  downloadUrl: `/api/microsoft/mail/messages/${selectedMessage.id}/raw`,
                  mimeType: "message/rfc822",
                  metadata: {
                    from: selectedMessage.from,
                    toRecipients: selectedMessage.toRecipients,
                    receivedDateTime: selectedMessage.receivedDateTime,
                    hasAttachments: selectedMessage.hasAttachments,
                  },
                }}
              />
              {!isMobile && (
                <Button variant="ghost" size="icon" onClick={handleBack} title="Close">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Subject */}
              <h2 className="text-lg font-semibold">{selectedMessage.subject || "(No subject)"}</h2>

              {/* Sender info */}
              <div className="flex items-start gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className={getAvatarColor(selectedMessage.from?.emailAddress?.name || "")}>
                    {getInitials(selectedMessage.from?.emailAddress?.name || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {selectedMessage.from?.emailAddress?.name || selectedMessage.from?.emailAddress?.address}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedMessage.receivedDateTime
                        ? formatDistanceToNow(new Date(selectedMessage.receivedDateTime), { addSuffix: true })
                        : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedMessage.from?.emailAddress?.address}
                  </p>
                  {selectedMessage.toRecipients && selectedMessage.toRecipients.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      To: {selectedMessage.toRecipients.map((r) => r.emailAddress.name || r.emailAddress.address).join(", ")}
                    </p>
                  )}
                  {selectedMessage.ccRecipients && selectedMessage.ccRecipients.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Cc: {selectedMessage.ccRecipients.map((r) => r.emailAddress.name || r.emailAddress.address).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Body — Graph API returns HTML directly */}
              {selectedMessage.body?.contentType === "html" ? (
                <div className="bg-white text-black rounded-lg p-4 shadow-sm border border-border/40">
                  <div
                    className="prose prose-sm max-w-none break-words [&_img]:max-w-full [&_table]:text-sm"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.body.content }}
                  />
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap text-foreground/90">
                  {selectedMessage.body?.content || selectedMessage.bodyPreview}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background">
      {/* Inject folder sidebar into main sidebar */}
      <SidebarSlotContent>
        <FolderSidebar
          folders={folders}
          activeFolderId={effectiveFolderId}
          onFolderChange={handleFolderChange}
          onCompose={handleCompose}
          loading={foldersLoading}
        />
      </SidebarSlotContent>

      {isMobile ? (
        <>
          {showMobileList && messageListContent}
          {showMobileDetail && detailContent}
        </>
      ) : selectedMessageId ? (
        <PanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel id="om" defaultSize="400px" minSize="300px">
            {messageListContent}
          </ResizablePanel>
          <ResizeHandle />
          <ResizablePanel id="od" defaultSize="1fr" minSize="300px">
            {detailContent}
          </ResizablePanel>
        </PanelGroup>
      ) : (
        messageListContent
      )}

      {/* Compose Dialog */}
      <Dialog open={compose.open} onOpenChange={(open) => setCompose((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {compose.mode === "reply" ? "Reply" : compose.mode === "forward" ? "Forward" : "New Message"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="To"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
            />
            <Input
              placeholder="Cc"
              value={composeCc}
              onChange={(e) => setComposeCc(e.target.value)}
            />
            <Input
              placeholder="Subject"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
            />
            <Textarea
              placeholder="Write your message..."
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className="min-h-[200px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCompose({ open: false, mode: "new" })}
              >
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendLoading || !composeTo.trim()}>
                {sendLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
