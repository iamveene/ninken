/**
 * Anthropic (Claude) LLM adapter.
 * Wraps the @anthropic-ai/sdk for streaming chat with tool use.
 */

import Anthropic from "@anthropic-ai/sdk"
import type {
  AIConfig,
  LLMAdapter,
  LLMContentBlock,
  LLMMessage,
  LLMStreamEvent,
  StreamChatParams,
} from "../types"

export class AnthropicAdapter implements LLMAdapter {
  readonly id = "anthropic" as const
  private client: Anthropic
  private model: string

  constructor(config: AIConfig) {
    this.model = config.model || "claude-sonnet-4-20250514"
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
  }

  async *streamChat(params: StreamChatParams): AsyncGenerator<LLMStreamEvent> {
    const { messages, systemPrompt, tools, maxTokens } = params

    // Convert LLMMessage[] to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string"
        ? m.content
        : m.content.map((block) => {
            if (block.type === "text") return { type: "text" as const, text: block.text }
            if (block.type === "tool_use") return {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input,
            }
            if (block.type === "tool_result") return {
              type: "tool_result" as const,
              tool_use_id: block.tool_use_id,
              content: block.content,
            }
            return { type: "text" as const, text: "" }
          }),
    }))

    const streamOpts: Anthropic.MessageStreamParams = {
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMessages,
    }

    if (tools.length > 0) {
      streamOpts.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool["input_schema"],
      }))
    }

    const stream = this.client.messages.stream(streamOpts)

    let fullText = ""
    let stopReason: string | null = null

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text
        yield { type: "delta", text: event.delta.text }
      }

      if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason
      }
    }

    // Get the final message to extract tool_use blocks
    const finalMessage = await stream.finalMessage()
    const toolUseBlocks: LLMContentBlock[] = []
    const allBlocks: LLMContentBlock[] = []

    for (const block of finalMessage.content) {
      if (block.type === "text") {
        allBlocks.push({ type: "text", text: block.text })
      } else if (block.type === "tool_use") {
        const toolBlock: LLMContentBlock = {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        }
        toolUseBlocks.push(toolBlock)
        allBlocks.push(toolBlock)
      }
    }

    if (toolUseBlocks.length > 0 && stopReason === "tool_use") {
      yield {
        type: "tool_start",
        tools: toolUseBlocks
          .filter((b): b is Extract<LLMContentBlock, { type: "tool_use" }> => b.type === "tool_use")
          .map((b) => ({ name: b.name, input: b.input })),
      }
    }

    // Always yield content blocks so the caller can reconstruct the conversation
    yield { type: "content_blocks", blocks: allBlocks }
    yield { type: "stop", reason: stopReason || "end_turn" }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with OK" }],
      })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")

      return {
        success: true,
        message: `Connected to Anthropic (${this.model}). Response: ${text.slice(0, 50)}`,
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        return {
          success: false,
          message: `Anthropic API error (${err.status}): ${err.message}`,
        }
      }
      return {
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
      }
    }
  }
}
