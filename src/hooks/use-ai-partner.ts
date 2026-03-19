"use client"

import { useState, useCallback, useRef } from "react"
import type { AIServiceContext } from "@/lib/ai/system-prompt"

export type AIMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  toolCalls?: { name: string; input: unknown }[]
  isStreaming?: boolean
}

type SSEEvent = {
  event: string
  data: string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const lines = chunk.split("\n")
  let currentEvent = ""
  let currentData = ""

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7)
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6)
    } else if (line === "" && currentEvent && currentData) {
      events.push({ event: currentEvent, data: currentData })
      currentEvent = ""
      currentData = ""
    }
  }

  return events
}

export function useAIPartner() {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string, context: AIServiceContext) => {
      if (!content.trim() || isStreaming) return

      setError(null)

      const userMessage: AIMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      }

      const assistantMessage: AIMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsStreaming(true)

      // Build conversation history (exclude streaming metadata)
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, context }),
          signal: abortController.signal,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(
            (errData as { error?: string }).error ||
              `Request failed: ${res.status}`
          )
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response stream")

        const decoder = new TextDecoder()
        let buffer = ""
        let accumulatedText = ""
        const toolCalls: { name: string; input: unknown }[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const events = parseSSEChunk(buffer)
          // Keep any incomplete data at the end of the buffer
          const lastNewline = buffer.lastIndexOf("\n\n")
          if (lastNewline !== -1) {
            buffer = buffer.slice(lastNewline + 2)
          }

          for (const event of events) {
            try {
              const data = JSON.parse(event.data)

              switch (event.event) {
                case "delta":
                  accumulatedText += data.text
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: accumulatedText }
                        : m
                    )
                  )
                  break

                case "tool_start":
                  if (Array.isArray(data.tools)) {
                    for (const tool of data.tools) {
                      if (tool) toolCalls.push(tool)
                    }
                  }
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, toolCalls: [...toolCalls] }
                        : m
                    )
                  )
                  break

                case "tool_end":
                  // Tool results received — model will continue generating text
                  break

                case "error":
                  setError(data.error || "AI request failed")
                  break

                case "done":
                  // Stream complete
                  break
              }
            } catch {
              // Skip malformed SSE data
            }
          }
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  isStreaming: false,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                }
              : m
          )
        )
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — mark message as complete with current content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, isStreaming: false }
                : m
            )
          )
        } else {
          const message =
            err instanceof Error ? err.message : "An error occurred"
          setError(message)
          // Remove the empty assistant message on error
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantMessage.id)
          )
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [messages, isStreaming]
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  }
}
