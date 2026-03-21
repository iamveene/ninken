"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"

type AIContextValue = {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  /** The current page path for context-aware prompts */
  currentPage: string
  setCurrentPage: (page: string) => void
  /** Pre-fill the input with a quick action */
  pendingPrompt: string | null
  setPendingPrompt: (prompt: string | null) => void
}

const AIContext = createContext<AIContextValue>({
  isOpen: false,
  openChat: () => {},
  closeChat: () => {},
  toggleChat: () => {},
  currentPage: "",
  setCurrentPage: () => {},
  pendingPrompt: null,
  setPendingPrompt: () => {},
})

export function useAI() {
  return useContext(AIContext)
}

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState("")
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), [])

  return (
    <AIContext
      value={{
        isOpen,
        openChat,
        closeChat,
        toggleChat,
        currentPage,
        setCurrentPage,
        pendingPrompt,
        setPendingPrompt,
      }}
    >
      {children}
    </AIContext>
  )
}
