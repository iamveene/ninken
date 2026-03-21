"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ResizablePanel, PanelGroup, ResizeHandle } from "@/components/ui/resize-handle"
import { TeamList } from "@/components/teams/team-list"
import { ChannelList } from "@/components/teams/channel-list"
import { ChannelMessages } from "@/components/teams/channel-messages"
import { ChatList } from "@/components/teams/chat-list"
import { ChatMessages } from "@/components/teams/chat-messages"
import { useJoinedTeams, useChannels, useChannelMessages, useChats, useChatMessages } from "@/hooks/use-teams"
import type { Chat } from "@/hooks/use-teams"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { ArrowLeft, Users, Hash, MessageSquare, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

function chatLabel(chat: Chat | undefined): string {
  if (!chat) return "Chat"
  if (chat.topic) return chat.topic
  if (chat.chatType === "oneOnOne") return "1:1 Chat"
  if (chat.chatType === "group") return "Group Chat"
  if (chat.chatType === "meeting") return "Meeting Chat"
  return "Chat"
}

function TeamsView() {
  const isMobile = useIsMobile()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<"teams" | "channels" | "messages">("teams")

  const { teams, loading: teamsLoading } = useJoinedTeams()
  const { channels, loading: channelsLoading } = useChannels(selectedTeamId)
  const { messages, loading: messagesLoading } = useChannelMessages(selectedTeamId, selectedChannelId)

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const selectedChannel = channels.find((c) => c.id === selectedChannelId)

  const handleTeamSelect = useCallback((teamId: string) => {
    setSelectedTeamId(teamId)
    setSelectedChannelId(null)
    if (isMobile) setMobileView("channels")
  }, [isMobile])

  const handleChannelSelect = useCallback((channelId: string) => {
    setSelectedChannelId(channelId)
    if (isMobile) setMobileView("messages")
  }, [isMobile])

  const handleBackToTeams = useCallback(() => {
    setSelectedTeamId(null)
    setSelectedChannelId(null)
    if (isMobile) setMobileView("teams")
  }, [isMobile])

  const handleBackToChannels = useCallback(() => {
    setSelectedChannelId(null)
    if (isMobile) setMobileView("channels")
  }, [isMobile])

  // Teams column
  const teamsColumn = (
    <div className="flex flex-col h-full border-r border-border/60">
      <div className="px-3 py-2.5 border-b flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Teams</h2>
      </div>
      <TeamList teams={teams} selectedId={selectedTeamId} onSelect={handleTeamSelect} loading={teamsLoading} />
    </div>
  )

  // Channels column
  const channelsColumn = (
    <div className="flex flex-col h-full border-r border-border/60">
      {isMobile && selectedTeamId && (
        <div className="px-2 py-1.5 border-b">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleBackToTeams}>
            <ArrowLeft className="h-3.5 w-3.5" /> Teams
          </Button>
        </div>
      )}
      {selectedTeamId ? (
        <ChannelList
          channels={channels}
          selectedId={selectedChannelId}
          onSelect={handleChannelSelect}
          loading={channelsLoading}
          teamName={selectedTeam?.displayName}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 h-full">
          <Hash className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center">Select a team to see channels</p>
        </div>
      )}
    </div>
  )

  // Messages column
  const messagesColumn = (
    <div className="flex flex-col h-full">
      {isMobile && selectedChannelId && (
        <div className="px-2 py-1.5 border-b">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleBackToChannels}>
            <ArrowLeft className="h-3.5 w-3.5" /> Channels
          </Button>
        </div>
      )}
      {selectedChannelId ? (
        <ChannelMessages
          messages={messages}
          loading={messagesLoading}
          channelName={selectedChannel?.displayName}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 h-full">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center">Select a channel to view messages</p>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex h-full">
        {mobileView === "teams" && teamsColumn}
        {mobileView === "channels" && channelsColumn}
        {mobileView === "messages" && messagesColumn}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <PanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel id="tt" defaultSize="220px" minSize="160px" maxSize="320px">
          {teamsColumn}
        </ResizablePanel>
        <ResizeHandle />
        <ResizablePanel id="tc" defaultSize="260px" minSize="180px" maxSize="380px">
          {channelsColumn}
        </ResizablePanel>
        <ResizeHandle />
        <ResizablePanel id="tm" defaultSize="1fr" minSize="300px">
          {messagesColumn}
        </ResizablePanel>
      </PanelGroup>
    </div>
  )
}

function ChatsView() {
  const isMobile = useIsMobile()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<"list" | "messages">("list")

  const { chats, loading: chatsLoading, error: chatsError } = useChats()
  const { messages, loading: messagesLoading } = useChatMessages(selectedChatId)

  const selectedChat = chats.find((c) => c.id === selectedChatId)

  const handleChatSelect = useCallback((chatId: string) => {
    setSelectedChatId(chatId)
    if (isMobile) setMobileView("messages")
  }, [isMobile])

  const handleBackToList = useCallback(() => {
    setSelectedChatId(null)
    if (isMobile) setMobileView("list")
  }, [isMobile])

  // Chat list column
  const listColumn = (
    <div className="flex flex-col h-full border-r border-border/60">
      <div className="px-3 py-2.5 border-b flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Chats</h2>
      </div>
      <ChatList
        chats={chats}
        selectedId={selectedChatId}
        onSelect={handleChatSelect}
        loading={chatsLoading}
        error={chatsError}
      />
    </div>
  )

  // Messages column
  const messagesColumn = (
    <div className="flex flex-col h-full">
      {isMobile && selectedChatId && (
        <div className="px-2 py-1.5 border-b">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleBackToList}>
            <ArrowLeft className="h-3.5 w-3.5" /> Chats
          </Button>
        </div>
      )}
      <ChatMessages
        messages={messages}
        loading={messagesLoading}
        chatLabel={selectedChatId ? chatLabel(selectedChat) : undefined}
      />
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex h-full">
        {mobileView === "list" && listColumn}
        {mobileView === "messages" && messagesColumn}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <PanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel id="cl" defaultSize="300px" minSize="200px" maxSize="420px">
          {listColumn}
        </ResizablePanel>
        <ResizeHandle />
        <ResizablePanel id="cm" defaultSize="1fr" minSize="300px">
          {messagesColumn}
        </ResizablePanel>
      </PanelGroup>
    </div>
  )
}

export default function TeamsPage() {
  const [activeTab, setActiveTab] = useState("teams")

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-4 bg-background flex-col overflow-hidden">
      <Tabs
        defaultValue="teams"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as string)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex items-center gap-4 px-4 pt-3 pb-2">
          <h1 className="text-lg font-semibold">Teams</h1>
          <TabsList>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="teams" className="flex flex-col flex-1 overflow-hidden">
          <TeamsView />
        </TabsContent>

        <TabsContent value="chats" className="flex flex-col flex-1 overflow-hidden">
          <ChatsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
