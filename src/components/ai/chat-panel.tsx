"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Send, Square, Trash2 } from "lucide-react"
import { useAI } from "./ai-context"
import { useProvider } from "@/components/providers/provider-context"
import { useAIPartner } from "@/hooks/use-ai-partner"
import { ChatMessage } from "./message"
import { QuickActions } from "./quick-actions"
import type { AIServiceContext } from "@/lib/ai/system-prompt"

export function ChatPanel() {
  const { isOpen, closeChat, pendingPrompt, setPendingPrompt, setCurrentPage } =
    useAI()
  const { provider, profile } = useProvider()
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } =
    useAIPartner()
  const [input, setInput] = useState("")
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
      // Auto-focus the input
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [pendingPrompt, isOpen, setPendingPrompt])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const buildContext = useCallback((): AIServiceContext => {
    return {
      provider: provider as "google" | "microsoft",
      userEmail: profile?.email ?? undefined,
      currentPage: pathname || undefined,
    }
  }, [provider, profile, pathname])

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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeChat()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-sm">Ninken AI</SheetTitle>
              <SheetDescription className="text-xs">
                {provider === "google" ? "Google Workspace" : "Microsoft 365"} assistant
              </SheetDescription>
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
          </div>
        </SheetHeader>

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
                  <QuickActions />
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
              <QuickActions />
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
      </SheetContent>
    </Sheet>
  )
}
