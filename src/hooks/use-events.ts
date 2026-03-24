"use client"

import { useEffect, useRef, useState } from "react"
import type { NinkenEvent, NinkenEventType } from "@/lib/event-bus"

type EventHandler = (event: NinkenEvent) => void

export function useEvents(
  handlers?: Partial<Record<NinkenEventType, EventHandler>>,
) {
  const [connected, setConnected] = useState(false)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource("/api/events")

      es.onopen = () => setConnected(true)

      es.onerror = () => {
        setConnected(false)
        es?.close()
        reconnectTimer = setTimeout(connect, 5_000)
      }

      // Listen for each known event type
      const eventTypes: NinkenEventType[] = [
        "audit_progress",
        "extraction_progress",
        "vault_change",
        "profile_status",
        "credential_injected",
      ]

      for (const type of eventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const event = JSON.parse(e.data) as NinkenEvent
            handlersRef.current?.[type]?.(event)
          } catch {
            // Ignore malformed events
          }
        })
      }
    }

    connect()

    return () => {
      es?.close()
      clearTimeout(reconnectTimer)
    }
  }, [])

  return { connected }
}
