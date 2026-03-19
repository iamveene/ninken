"use client"

import { useState, useCallback, useMemo } from "react"
import { ResizablePanel, PanelGroup, ResizeHandle } from "@/components/ui/resize-handle"
import { SpaceList } from "@/components/chat/space-list"
import { MessageList } from "@/components/chat/message-list"
import { ThreadPanel } from "@/components/chat/thread-panel"
import { SearchBar } from "@/components/chat/search-bar"
import { SidebarSlotContent } from "@/components/sidebar-slot"
import { useSpaces, useSpaceMessages, extractSpaceId } from "@/hooks/use-chat"
import { useIsMobile } from "@/hooks/use-mobile"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ChatPage() {
  const isMobile = useIsMobile()
  const [selectedSpaceName, setSelectedSpaceName] = useState<string | null>(null)
  const [activeThreadName, setActiveThreadName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileView, setMobileView] = useState<"spaces" | "messages" | "thread">("spaces")

  const { spaces, loading: spacesLoading, error: spacesError, refetch: refetchSpaces } = useSpaces()
  const selectedSpaceId = selectedSpaceName ? extractSpaceId(selectedSpaceName) : null
  const { messages, loading: messagesLoading } = useSpaceMessages(selectedSpaceId)

  const selectedSpace = spaces.find((s) => s.name === selectedSpaceName)

  const filteredSpaces = useMemo(() => {
    if (!searchQuery) return spaces
    const q = searchQuery.toLowerCase()
    return spaces.filter((s) => {
      const label = s.displayName || s.name
      return label.toLowerCase().includes(q)
    })
  }, [spaces, searchQuery])

  const handleSpaceSelect = useCallback((spaceName: string) => {
    setSelectedSpaceName(spaceName)
    setActiveThreadName(null)
    if (isMobile) setMobileView("messages")
  }, [isMobile])

  const handleThreadClick = useCallback((threadName: string) => {
    setActiveThreadName(threadName)
    if (isMobile) setMobileView("thread")
  }, [isMobile])

  const handleCloseThread = useCallback(() => {
    setActiveThreadName(null)
    if (isMobile) setMobileView("messages")
  }, [isMobile])

  const handleBackToSpaces = useCallback(() => {
    setSelectedSpaceName(null)
    setActiveThreadName(null)
    if (isMobile) setMobileView("spaces")
  }, [isMobile])

  const handleBackToMessages = useCallback(() => {
    setActiveThreadName(null)
    if (isMobile) setMobileView("messages")
  }, [isMobile])

  const getSpaceDisplayName = () => {
    if (!selectedSpace) return undefined
    return selectedSpace.displayName || "Space"
  }

  // Space list for the sidebar slot
  const spacesContent = (
    <div className="flex flex-col h-full">
      <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search conversations..." />
      <SpaceList
        spaces={filteredSpaces}
        selectedId={selectedSpaceName}
        onSelect={handleSpaceSelect}
        loading={spacesLoading}
        error={spacesError}
        onRetry={refetchSpaces}
      />
    </div>
  )

  // Messages column
  const messagesColumn = (
    <div className="flex flex-col h-full">
      {isMobile && selectedSpaceName && (
        <div className="px-2 py-1.5 border-b">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleBackToSpaces}>
            <ArrowLeft className="h-3.5 w-3.5" /> Chats
          </Button>
        </div>
      )}
      {selectedSpaceName ? (
        <MessageList
          messages={messages}
          loading={messagesLoading}
          spaceName={getSpaceDisplayName()}
          onThreadClick={handleThreadClick}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 h-full">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center">Select a conversation from the sidebar</p>
        </div>
      )}
    </div>
  )

  // Thread column
  const threadColumn = activeThreadName ? (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-2 py-1.5 border-b">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleBackToMessages}>
            <ArrowLeft className="h-3.5 w-3.5" /> Messages
          </Button>
        </div>
      )}
      <ThreadPanel
        messages={messages}
        threadName={activeThreadName}
        loading={messagesLoading}
        onClose={handleCloseThread}
      />
    </div>
  ) : null

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background">
        {mobileView === "spaces" && spacesContent}
        {mobileView === "messages" && messagesColumn}
        {mobileView === "thread" && threadColumn}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background">
      {/* Inject space list into the main sidebar */}
      <SidebarSlotContent>
        {spacesContent}
      </SidebarSlotContent>

      {activeThreadName ? (
        <PanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel id="cm" defaultSize="1fr" minSize="300px">
            {messagesColumn}
          </ResizablePanel>
          <ResizeHandle />
          <ResizablePanel id="ct" defaultSize="320px" minSize="240px" maxSize="500px">
            {threadColumn}
          </ResizablePanel>
        </PanelGroup>
      ) : (
        messagesColumn
      )}
    </div>
  )
}
