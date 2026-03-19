import Anthropic from "@anthropic-ai/sdk"
import { cookies } from "next/headers"
import { buildSystemPrompt, type AIServiceContext } from "@/lib/ai/system-prompt"
import {
  getToolsForProvider,
  TOOL_ROUTES,
  type ToolName,
} from "@/lib/ai/tools"

export const dynamic = "force-dynamic"

const MODEL = process.env.NINKEN_AI_MODEL || "claude-opus-4-6"

type IncomingMessage = {
  role: "user" | "assistant"
  content: string
}

type RequestBody = {
  messages: IncomingMessage[]
  context: AIServiceContext
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

export async function POST(request: Request) {
  // Verify API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
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

  const { messages, context } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Messages required" }, { status: 400 })
  }

  if (!context?.provider) {
    return Response.json({ error: "Provider context required" }, { status: 400 })
  }

  // Build the cookie header to forward to internal API routes
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  const client = new Anthropic({ apiKey })

  const systemPrompt = buildSystemPrompt(context)
  const tools = getToolsForProvider(context.provider)

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

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
        let currentMessages = anthropicMessages

        // Tool-use loop: keep calling the model until it stops requesting tools
        let maxIterations = 10
        while (maxIterations-- > 0) {
          const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            tools,
            messages: currentMessages,
          })

          let fullText = ""
          const toolUseBlocks: Anthropic.ContentBlock[] = []
          let stopReason: string | null = null

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullText += event.delta.text
              sendEvent("delta", { text: event.delta.text })
            }

            if (
              event.type === "content_block_stop" &&
              event.index !== undefined
            ) {
              // Collect tool_use blocks from the final message
            }

            if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason
            }
          }

          // Get the final message to check for tool use
          const finalMessage = await stream.finalMessage()

          for (const block of finalMessage.content) {
            if (block.type === "tool_use") {
              toolUseBlocks.push(block)
            }
          }

          if (toolUseBlocks.length === 0 || stopReason !== "tool_use") {
            // No tool calls — we're done
            break
          }

          // Execute tool calls and continue the conversation
          sendEvent("tool_start", {
            tools: toolUseBlocks.map((b) =>
              b.type === "tool_use" ? { name: b.name, input: b.input } : null
            ).filter(Boolean),
          })

          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const block of toolUseBlocks) {
            if (block.type !== "tool_use") continue

            const result = await executeTool(
              block.name as ToolName,
              block.input as Record<string, unknown>,
              cookieHeader
            )

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            })
          }

          sendEvent("tool_end", {
            results: toolResults.map((r) => ({
              tool_use_id: r.tool_use_id,
              preview:
                typeof r.content === "string"
                  ? r.content.slice(0, 200)
                  : "...",
            })),
          })

          // Add assistant message + tool results to continue the loop
          currentMessages = [
            ...currentMessages,
            { role: "assistant" as const, content: finalMessage.content },
            { role: "user" as const, content: toolResults },
          ]
        }

        sendEvent("done", {})
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI request failed"
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
