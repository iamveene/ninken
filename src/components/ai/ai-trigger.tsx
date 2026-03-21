"use client"

import { MessageCircle, X } from "lucide-react"
import { useAI } from "./ai-context"
import { ChatPanel } from "./chat-panel"

export function AITrigger() {
  const { isOpen, toggleChat } = useAI()

  return (
    <>
      <button
        onClick={toggleChat}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
        aria-label={isOpen ? "Close AI Partner" : "Open AI Partner"}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>
      <ChatPanel />
    </>
  )
}
