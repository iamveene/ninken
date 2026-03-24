"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"

type SidebarSlotValue = {
  content: ReactNode | null
  setContent: (content: ReactNode | null) => void
}

const SidebarSlotContext = createContext<SidebarSlotValue>({
  content: null,
  setContent: () => {},
})

export function SidebarSlotProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)
  return (
    <SidebarSlotContext value={{ content, setContent }}>
      {children}
    </SidebarSlotContext>
  )
}

export function useSidebarSlot() {
  return useContext(SidebarSlotContext)
}

/**
 * Component that injects its children into the main sidebar's content area.
 * Cleans up on unmount (navigating away from the service).
 */
export function SidebarSlotContent({ children }: { children: ReactNode }) {
  const { setContent } = useSidebarSlot()

  useEffect(() => {
    setContent(children)
    return () => setContent(null)
  }, [children, setContent])

  return null
}
