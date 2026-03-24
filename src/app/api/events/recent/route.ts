import { eventBus } from "@/lib/event-bus"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const count = Math.min(
    parseInt(searchParams.get("count") || "20", 10) || 20,
    100,
  )
  const events = eventBus.getRecent(count)
  return Response.json({ events, count: events.length })
}
