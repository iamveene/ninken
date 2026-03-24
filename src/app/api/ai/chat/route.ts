import { cookies } from "next/headers"
import { readAIConfig, createLLMAdapter } from "@/lib/llm"
import type { LLMMessage, LLMContentBlock } from "@/lib/llm"
import { buildSystemPrompt, type AIServiceContext } from "@/lib/ai/system-prompt"
import {
  getToolsForProvider,
  TOOL_ROUTES,
  type ToolName,
} from "@/lib/ai/tools"

export const dynamic = "force-dynamic"

type IncomingMessage = {
  role: "user" | "assistant"
  content: string
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

type RequestBody = {
  messages: IncomingMessage[]
  context: AIServiceContext
  /** Client-side collection items for offline search_collection tool */
  collectionItems?: CollectionItemSummary[]
}

/**
 * Execute a tool by calling the corresponding internal API route,
 * forwarding cookies from the original request for auth.
 */
async function executeTool(
  toolName: ToolName,
  input: Record<string, unknown>,
  cookieHeader: string
): Promise<string> {
  const route = TOOL_ROUTES[toolName]
  if (!route) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:4000"
  let url = `${baseUrl}${route.path}`

  if (route.method === "GET" && route.buildParams) {
    const params = route.buildParams(input)
    if (params) url += `?${params.toString()}`
  }

  try {
    const fetchOptions: RequestInit = {
      method: route.method,
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
    }

    if (route.method === "POST" && route.buildBody) {
      fetchOptions.body = JSON.stringify(route.buildBody(input))
    }

    const res = await fetch(url, fetchOptions)
    const data = await res.json()

    if (!res.ok) {
      return JSON.stringify({
        error: data.error || `API returned ${res.status}`,
      })
    }

    // Truncate large responses to stay within token limits
    const text = JSON.stringify(data)
    if (text.length > 30000) {
      return text.slice(0, 30000) + "\n...[truncated]"
    }
    return text
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : "Tool execution failed",
    })
  }
}

/**
 * Execute a collection search against client-provided collection items.
 * This runs server-side but uses data passed from the client (IndexedDB).
 */
function executeCollectionSearch(
  input: Record<string, unknown>,
  items: CollectionItemSummary[]
): string {
  let results = [...items]

  // Filter by query (case-insensitive substring match on title, subtitle, metadata)
  if (input.query && typeof input.query === "string") {
    const q = (input.query as string).toLowerCase()
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.metadata &&
          JSON.stringify(item.metadata).toLowerCase().includes(q))
    )
  }

  // Filter by source
  if (input.source && typeof input.source === "string") {
    results = results.filter((item) => item.source === input.source)
  }

  // Filter by type
  if (input.type && typeof input.type === "string") {
    results = results.filter((item) => item.type === input.type)
  }

  // Apply limit
  const limit = Math.min(Math.max(Number(input.limit) || 25, 1), 100)
  results = results.slice(0, limit)

  const response = {
    items: results.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      source: item.source,
      type: item.type,
      status: item.status,
      collectedAt: new Date(item.collectedAt).toISOString(),
      sizeBytes: item.sizeBytes,
      metadata: item.metadata,
    })),
    total: results.length,
    totalInCollection: items.length,
    mode: "offline" as const,
  }

  const text = JSON.stringify(response)
  if (text.length > 30000) {
    return text.slice(0, 30000) + "\n...[truncated]"
  }
  return text
}

export async function POST(request: Request) {
  // Read multi-vendor AI config (falls back to ANTHROPIC_API_KEY env var)
  const config = await readAIConfig()
  if (!config.apiKey && config.provider !== "ollama") {
    return Response.json(
      { error: `No API key configured for ${config.provider}. Set up ai.config.json or ANTHROPIC_API_KEY env var.` },
      { status: 500 }
    )
  }

  // Verify user is authenticated
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get("ninken_token")
  if (!tokenCookie?.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { messages, context, collectionItems } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Messages required" }, { status: 400 })
  }

  if (!context?.provider) {
    return Response.json({ error: "Provider context required" }, { status: 400 })
  }

  const searchMode = context.mode ?? "online"

  // Build the cookie header to forward to internal API routes
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  const adapter = createLLMAdapter(config)

  const systemPrompt = buildSystemPrompt(context)
  const tools = getToolsForProvider(context.provider, searchMode)

  // Stream the response using SSE
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        let currentMessages: LLMMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        // No tools for Ollama (most local models don't support function calling)
        const toolsForProvider = config.provider === "ollama" ? [] : tools

        // Tool-use loop: keep calling the model until it stops requesting tools
        let maxIterations = 10
        while (maxIterations-- > 0) {
          let fullText = ""
          const toolUseBlocks: Extract<LLMContentBlock, { type: "tool_use" }>[] = []
          let contentBlocks: LLMContentBlock[] = []
          let hadToolStart = false
          let hadError = false

          for await (const event of adapter.streamChat({
            messages: currentMessages,
            systemPrompt,
            tools: toolsForProvider,
            maxTokens: 4096,
          })) {
            if (event.type === "delta") {
              fullText += event.text
              sendEvent("delta", { text: event.text })
            } else if (event.type === "tool_start") {
              hadToolStart = true
              sendEvent("tool_start", {
                tools: event.tools,
              })
            } else if (event.type === "content_blocks") {
              contentBlocks = event.blocks
              // Extract tool_use blocks for execution
              for (const block of event.blocks) {
                if (block.type === "tool_use") {
                  toolUseBlocks.push(block)
                }
              }
            } else if (event.type === "error") {
              sendEvent("error", { error: event.error })
              hadError = true
              break
            }
          }

          if (hadError) break

          // If no tool calls, we're done
          if (toolUseBlocks.length === 0 || !hadToolStart) {
            break
          }

          // Execute tool calls
          const toolResults: LLMContentBlock[] = []

          for (const block of toolUseBlocks) {
            let result: string

            // For search_collection in offline mode, inject collection items
            if (block.name === "search_collection" && searchMode === "offline") {
              result = executeCollectionSearch(
                block.input,
                collectionItems ?? []
              )
            } else {
              result = await executeTool(
                block.name as ToolName,
                block.input,
                cookieHeader
              )
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            })
          }

          sendEvent("tool_end", {
            results: toolResults.map((r) => ({
              tool_use_id: r.type === "tool_result" ? r.tool_use_id : "",
              preview:
                r.type === "tool_result"
                  ? r.content.slice(0, 200)
                  : "...",
            })),
          })

          // Add assistant message + tool results to continue the loop
          currentMessages = [
            ...currentMessages,
            { role: "assistant" as const, content: contentBlocks },
            { role: "user" as const, content: toolResults },
          ]
        }

        sendEvent("done", {})
      } catch (err) {
        let message = "AI request failed"

        if (err instanceof Error) {
          // Check for common API error patterns
          const errMsg = err.message.toLowerCase()
          if (errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("invalid api key")) {
            message = `Invalid API key for ${config.provider} — check your configuration`
          } else if (errMsg.includes("429") || errMsg.includes("rate limit")) {
            message = `Rate limited by ${config.provider} API — wait a moment and try again`
          } else if (errMsg.includes("529") || errMsg.includes("overloaded")) {
            message = `${config.provider} API is temporarily overloaded — try again shortly`
          } else {
            message = err.message
          }
        }

        sendEvent("error", { error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
