"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Bot, Send, Square, Trash2, X, Globe, HardDrive, Filter } from "lucide-react"
import { useAI } from "./ai-context"
import { useProvider } from "@/components/providers/provider-context"
import { useScopes } from "@/hooks/use-scopes"
import { useAIPartner } from "@/hooks/use-ai-partner"
import { ChatMessage } from "./message"
import { QuickActions } from "./quick-actions"
import type { AIServiceContext, AIAppFilter } from "@/lib/ai/system-prompt"

export function ChatPanel() {
  const { isOpen, closeChat, pendingPrompt, setPendingPrompt, setCurrentPage } =
    useAI()
  const { provider, profile } = useProvider()
  const { scopes } = useScopes()
  const { messages, isStreaming, error, mode, setMode, sendMessage, stopStreaming, clearMessages } =
    useAIPartner()
  const [input, setInput] = useState("")
  const [appFilter, setAppFilter] = useState<AIAppFilter>("all")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()

  // Keep current page in sync
  useEffect(() => {
    setCurrentPage(pathname || "")
  }, [pathname, setCurrentPage])

  // Handle pending prompts from quick actions
  useEffect(() => {
    if (pendingPrompt && isOpen) {
      setInput(pendingPrompt)
      setPendingPrompt(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [pendingPrompt, isOpen, setPendingPrompt])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  const buildContext = useCallback((): AIServiceContext => {
    return {
      provider: provider,
      userEmail: profile?.email ?? undefined,
      currentPage: pathname || undefined,
      scopes: scopes ?? undefined,
      mode,
      appFilter,
    }
  }, [provider, profile, pathname, scopes, mode, appFilter])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    await sendMessage(text, buildContext())
  }, [input, isStreaming, sendMessage, buildContext])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  if (!isOpen) return null

  return (
    <div className="fixed bottom-20 right-5 z-50 flex w-[400px] flex-col rounded-xl border border-border bg-background shadow-2xl"
      style={{ height: "min(600px, calc(100vh - 120px))" }}
    >
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Ninken AI</p>
            <p className="text-xs text-muted-foreground">
              {{ google: "Google Workspace", microsoft: "Microsoft 365", github: "GitHub", gitlab: "GitLab", slack: "Slack", aws: "AWS" }[provider] ?? provider} assistant
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clearMessages}
              aria-label="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={closeChat}
            aria-label="Close chat"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Mode toggle + App filter bar */}
        <div className="flex items-center gap-2 px-4 pb-2">
          {/* Online/Offline segmented toggle */}
          <div className="flex rounded-md border border-border text-[11px]">
            <Tooltip>
              <TooltipTrigger
                onClick={() => setMode("online")}
                className={`flex items-center gap-1 rounded-l-md px-2 py-1 transition-colors ${
                  mode === "online"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <Globe className="h-3 w-3" />
                Live
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Online: Query live APIs (generates audit logs)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                onClick={() => setMode("offline")}
                className={`flex items-center gap-1 rounded-r-md px-2 py-1 transition-colors ${
                  mode === "offline"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <HardDrive className="h-3 w-3" />
                Collection
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Offline: Search cached IndexedDB data (zero OPSEC risk)
              </TooltipContent>
            </Tooltip>
          </div>

          {/* App filter dropdown */}
          <Select value={appFilter} onValueChange={(v) => { if (v) setAppFilter(v as AIAppFilter) }}>
            <SelectTrigger size="sm" className="h-6 gap-1 border-border px-2 text-[11px]">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={4}>
              <SelectItem value="all" className="text-xs">All Apps</SelectItem>
              <SelectItem value="email" className="text-xs">Email</SelectItem>
              <SelectItem value="drive" className="text-xs">Drive / Files</SelectItem>
              <SelectItem value="repos" className="text-xs">Repos</SelectItem>
              <SelectItem value="channels" className="text-xs">Channels</SelectItem>
              <SelectItem value="cloud" className="text-xs">Cloud Infra</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div ref={scrollRef} className="flex flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Bot className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">Ninken AI Partner</p>
              <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                Ask questions about the target environment, search for
                sensitive data, or get reconnaissance suggestions.
              </p>
              <div className="mt-4 w-full">
                <QuickActions mode={mode} />
              </div>
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3">
        {messages.length > 0 && !isStreaming && (
          <div className="mb-2">
            <QuickActions mode={mode} />
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Ninken AI..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            style={{ minHeight: "36px", maxHeight: "120px", fieldSizing: "content" as never }}
          />
          {isStreaming ? (
            <Button
              variant="outline"
              size="icon"
              onClick={stopStreaming}
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
