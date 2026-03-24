import { eventBus } from "@/lib/event-bus"

export const dynamic = "force-dynamic"

export async function GET() {
  const encoder = new TextEncoder()

  // Shared cleanup state so `cancel()` can tear down resources
  // created inside `start()`.
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat so EventSource knows the connection is alive
      controller.enqueue(encoder.encode(": heartbeat\n\n"))

      // Subscribe to all events
      const unsubscribe = eventBus.subscribe((event) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          unsubscribe()
        }
      })

      // Heartbeat every 30s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 30_000)

      // Expose cleanup for the cancel() callback
      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
    },

    cancel() {
      // ReadableStream.cancel is called when the consumer disconnects
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
