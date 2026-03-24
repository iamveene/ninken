export type NinkenEventType =
  | "audit_progress"
  | "extraction_progress"
  | "vault_change"
  | "profile_status"
  | "credential_injected"

export type NinkenEvent = {
  id: string
  type: NinkenEventType
  payload: Record<string, unknown>
  timestamp: string
}

type EventCallback = (event: NinkenEvent) => void

class EventBus {
  private listeners = new Set<EventCallback>()
  private buffer: NinkenEvent[] = []
  private maxBufferSize = 100

  publish(type: NinkenEventType, payload: Record<string, unknown>): void {
    const event: NinkenEvent = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: new Date().toISOString(),
    }
    this.buffer.push(event)
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize)
    }
    for (const cb of this.listeners) {
      try {
        cb(event)
      } catch {
        // Swallow errors from individual listeners
      }
    }
  }

  subscribe(cb: EventCallback): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  getRecent(count = 20): NinkenEvent[] {
    return this.buffer.slice(-count)
  }
}

// Singleton — survives hot-reload in dev via globalThis
const globalKey = Symbol.for("ninken-event-bus")
const g = globalThis as unknown as { [key: symbol]: EventBus }
export const eventBus: EventBus = g[globalKey] ?? (g[globalKey] = new EventBus())
