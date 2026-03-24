/**
 * API route for searching the collection (offline mode).
 *
 * This route receives search parameters from the AI tool executor and
 * returns matching collection items. Since IndexedDB is client-side only,
 * this route acts as a proxy: the actual search happens client-side and
 * results are passed through the AI chat API's tool execution flow.
 *
 * For server-side execution, this route returns a placeholder instructing
 * the AI to inform the user that collection search runs client-side.
 *
 * In practice, the chat route intercepts `search_collection` tool calls
 * and executes them via a special handler that returns collection data
 * from the request body (passed from the client).
 */

import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

type SearchRequest = {
  query?: string
  source?: string
  type?: string
  limit?: number
  // Client-side collection data (pre-searched) passed from the chat route
  collectionItems?: CollectionItemSummary[]
}

type CollectionItemSummary = {
  id: string
  title: string
  subtitle?: string
  source: string
  type: string
  status: string
  collectedAt: number
  sizeBytes?: number
  metadata?: Record<string, unknown>
}

export async function POST(request: Request) {
  // Verify user is authenticated
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get("ninken_token")
  if (!tokenCookie?.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SearchRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  // If collection items were passed from client-side (pre-searched), filter and return them
  if (body.collectionItems && Array.isArray(body.collectionItems)) {
    let results = body.collectionItems

    // Apply server-side filters if any
    if (body.query) {
      const q = body.query.toLowerCase()
      results = results.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          (item.metadata &&
            JSON.stringify(item.metadata).toLowerCase().includes(q))
      )
    }

    if (body.source) {
      results = results.filter((item) => item.source === body.source)
    }

    if (body.type) {
      results = results.filter((item) => item.type === body.type)
    }

    const limit = Math.min(Math.max(body.limit ?? 25, 1), 100)
    results = results.slice(0, limit)

    return Response.json({
      items: results,
      total: results.length,
      mode: "offline",
    })
  }

  // No pre-searched data — return instruction for client-side execution
  return Response.json({
    items: [],
    total: 0,
    mode: "offline",
    note: "Collection search executes against client-side IndexedDB. No cached data was provided in this request.",
  })
}
