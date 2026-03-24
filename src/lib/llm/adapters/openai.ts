/**
 * OpenAI LLM adapter.
 * Also handles Ollama via baseURL override (Ollama exposes an OpenAI-compatible API).
 */

import OpenAI from "openai"
import type {
  AIConfig,
  LLMAdapter,
  LLMContentBlock,
  LLMStreamEvent,
  StreamChatParams,
} from "../types"

export class OpenAIAdapter implements LLMAdapter {
  readonly id: "openai" | "ollama" | "openrouter"
  private client: OpenAI
  private model: string
  private isOllama: boolean
  private isOpenRouter: boolean

  constructor(config: AIConfig) {
    this.isOllama = config.provider === "ollama"
    this.isOpenRouter = config.provider === "openrouter"
    this.id = config.provider as "openai" | "ollama" | "openrouter"
    this.model = config.model || (this.isOllama ? "llama3.1:8b" : "gpt-4o")

    this.client = new OpenAI({
      apiKey: this.isOllama ? "ollama" : config.apiKey,
      baseURL: this.isOllama
        ? (config.endpointUrl || "http://localhost:11434") + "/v1"
        : this.isOpenRouter
          ? "https://openrouter.ai/api/v1"
          : undefined,
      timeout: this.isOllama ? 600_000 : 60_000, // 10min for Ollama CPU inference
    })
  }

  async *streamChat(params: StreamChatParams): AsyncGenerator<LLMStreamEvent> {
    const { messages, systemPrompt, tools, maxTokens } = params

    // Build OpenAI messages with system prompt first
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ]

    for (const m of messages) {
      if (typeof m.content === "string") {
        openaiMessages.push({ role: m.role, content: m.content })
      } else {
        // Convert content blocks to OpenAI format
        const textParts = m.content.filter((b) => b.type === "text")
        const toolUseParts = m.content.filter((b) => b.type === "tool_use")
        const toolResultParts = m.content.filter((b) => b.type === "tool_result")

        if (m.role === "assistant") {
          // Assistant messages may contain text + tool_calls
          const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = toolUseParts.map(
            (b) => {
              if (b.type !== "tool_use") throw new Error("unexpected block type")
              return {
                id: b.id,
                type: "function" as const,
                function: {
                  name: b.name,
                  arguments: JSON.stringify(b.input),
                },
              }
            }
          )

          const msg: OpenAI.ChatCompletionAssistantMessageParam = {
            role: "assistant",
            content: textParts.map((b) => (b.type === "text" ? b.text : "")).join("") || null,
          }
          if (toolCalls.length > 0) {
            msg.tool_calls = toolCalls
          }
          openaiMessages.push(msg)
        } else {
          // User messages with tool results
          if (toolResultParts.length > 0) {
            for (const b of toolResultParts) {
              if (b.type !== "tool_result") continue
              openaiMessages.push({
                role: "tool",
                tool_call_id: b.tool_use_id,
                content: b.content,
              })
            }
          } else {
            openaiMessages.push({
              role: "user",
              content: textParts.map((b) => (b.type === "text" ? b.text : "")).join(""),
            })
          }
        }
      }
    }

    // Build tool definitions — skip for Ollama (most local models don't support function calling)
    const openaiTools: OpenAI.ChatCompletionTool[] | undefined =
      !this.isOllama && tools.length > 0
        ? tools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.input_schema as unknown as Record<string, unknown>,
            },
          }))
        : undefined

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      stream: true,
      ...(openaiTools ? { tools: openaiTools } : {}),
    })

    let fullText = ""
    // Accumulate tool calls from deltas
    const toolCallAccumulator = new Map<
      number,
      { id: string; name: string; arguments: string }
    >()
    let finishReason: string | null = null

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (!choice) continue

      const delta = choice.delta

      // Handle text content
      if (delta?.content) {
        fullText += delta.content
        yield { type: "delta", text: delta.content }
      }

      // Handle tool call deltas
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!toolCallAccumulator.has(idx)) {
            toolCallAccumulator.set(idx, {
              id: tc.id || "",
              name: tc.function?.name || "",
              arguments: "",
            })
          }
          const acc = toolCallAccumulator.get(idx)!
          if (tc.id) acc.id = tc.id
          if (tc.function?.name) acc.name = tc.function.name
          if (tc.function?.arguments) acc.arguments += tc.function.arguments
        }
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason
      }
    }

    // Build content blocks
    const allBlocks: LLMContentBlock[] = []

    if (fullText) {
      allBlocks.push({ type: "text", text: fullText })
    }

    // Process accumulated tool calls
    const toolUseBlocks: LLMContentBlock[] = []
    for (const [, acc] of toolCallAccumulator) {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = JSON.parse(acc.arguments || "{}")
      } catch {
        parsedArgs = {}
      }
      const block: LLMContentBlock = {
        type: "tool_use",
        id: acc.id,
        name: acc.name,
        input: parsedArgs,
      }
      toolUseBlocks.push(block)
      allBlocks.push(block)
    }

    if (toolUseBlocks.length > 0 && finishReason === "tool_calls") {
      yield {
        type: "tool_start",
        tools: toolUseBlocks
          .filter(
            (b): b is Extract<LLMContentBlock, { type: "tool_use" }> =>
              b.type === "tool_use"
          )
          .map((b) => ({ name: b.name, input: b.input })),
      }
    }

    yield { type: "content_blocks", blocks: allBlocks }
    yield { type: "stop", reason: finishReason || "stop" }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // For Ollama, also verify the model is available
      if (this.isOllama) {
        const baseUrl = this.client.baseURL.replace(/\/v1\/?$/, "")
        const tagsRes = await fetch(`${baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(10_000),
        })
        if (!tagsRes.ok) {
          return {
            success: false,
            message: `Ollama not reachable at ${baseUrl} (HTTP ${tagsRes.status})`,
          }
        }
        const tags = (await tagsRes.json()) as {
          models?: { name: string }[]
        }
        const available = tags.models?.map((m) => m.name) ?? []
        const modelBase = this.model.split(":")[0]
        const found = available.some(
          (n) => n === this.model || n.startsWith(modelBase + ":")
        )
        if (!found) {
          return {
            success: false,
            message: `Ollama is running but model "${this.model}" is not available. Available: ${available.join(", ") || "none"}. Pull it with: ollama pull ${this.model}`,
          }
        }
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with OK" }],
      })

      const text = response.choices[0]?.message?.content || ""

      return {
        success: true,
        message: `Connected to ${this.isOllama ? "Ollama" : this.isOpenRouter ? "OpenRouter" : "OpenAI"} (${this.model}). Response: ${text.slice(0, 50)}`,
      }
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        return {
          success: false,
          message: `${this.isOllama ? "Ollama" : this.isOpenRouter ? "OpenRouter" : "OpenAI"} API error (${err.status}): ${err.message}`,
        }
      }
      return {
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
      }
    }
  }
}
