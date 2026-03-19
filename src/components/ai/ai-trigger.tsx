"use client"

import { BrainCircuit } from "lucide-react"
import { useAI } from "./ai-context"
import { ChatPanel } from "./chat-panel"

export function AITrigger() {
  const { toggleChat } = useAI()

  return (
    <>
      <button
        onClick={toggleChat}
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        aria-label="Open AI Partner"
      >
        <BrainCircuit className="h-4 w-4 text-muted-foreground" />
      </button>
      <ChatPanel />
    </>
  )
}
