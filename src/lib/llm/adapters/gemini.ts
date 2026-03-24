/**
 * Gemini LLM adapter.
 * Uses the REST streaming API directly (no SDK dependency).
 */

import type {
  AIConfig,
  LLMAdapter,
  LLMContentBlock,
  LLMStreamEvent,
  StreamChatParams,
} from "../types"

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

/** All Gemini safety categories — set to BLOCK_NONE for red team context. */
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
]

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

type GeminiContent = {
  role: "user" | "model"
  parts: GeminiPart[]
}

export class GeminiAdapter implements LLMAdapter {
  readonly id = "gemini" as const
  private apiKey: string
  private model: string

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey || ""
    this.model = config.model || "gemini-2.5-flash"
  }

  async *streamChat(params: StreamChatParams): AsyncGenerator<LLMStreamEvent> {
    const { messages, systemPrompt, tools, maxTokens } = params

    // Convert messages to Gemini format
    const contents: GeminiContent[] = []

    for (const m of messages) {
      const role = m.role === "assistant" ? "model" : "user"

      if (typeof m.content === "string") {
        contents.push({ role, parts: [{ text: m.content }] })
      } else {
        const parts: GeminiPart[] = []
        for (const block of m.content) {
          if (block.type === "text") {
            parts.push({ text: block.text })
          } else if (block.type === "tool_use") {
            parts.push({
              functionCall: { name: block.name, args: block.input },
            })
          } else if (block.type === "tool_result") {
            // Tool results in Gemini are functionResponse parts
            let parsed: Record<string, unknown>
            try {
              parsed = JSON.parse(block.content)
            } catch {
              parsed = { result: block.content }
            }
            parts.push({
              functionResponse: {
                name: block.tool_use_id, // Gemini uses function name, not ID
                response: parsed,
              },
            })
          }
        }
        if (parts.length > 0) {
          contents.push({ role, parts })
        }
      }
    }

    // Build request body
    const body: Record<string, unknown> = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
      },
      safetySettings: SAFETY_SETTINGS,
    }

    // Add tools if provided
    if (tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          })),
        },
      ]
    }

    const url = `${GEMINI_BASE}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorMessage = `Gemini API error (${response.status})`
      try {
        const errData = await response.json()
        if (errData?.error?.message) {
          errorMessage = `Gemini API error (${response.status}): ${errData.error.message}`
        }
      } catch {
        // Use default error message
      }
      yield { type: "error", error: errorMessage }
      return
    }

    if (!response.body) {
      yield { type: "error", error: "Gemini returned no response body" }
      return
    }

    let fullText = ""
    const toolCalls: { name: string; args: Record<string, unknown> }[] = []

    // Parse SSE stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE lines
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === "[DONE]") continue

          try {
            const data = JSON.parse(jsonStr)
            const candidate = data.candidates?.[0]
            if (!candidate?.content?.parts) continue

            for (const part of candidate.content.parts as GeminiPart[]) {
              if ("text" in part && part.text) {
                fullText += part.text
                yield { type: "delta", text: part.text }
              } else if ("functionCall" in part) {
                toolCalls.push({
                  name: part.functionCall.name,
                  args: part.functionCall.args || {},
                })
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Build content blocks
    const allBlocks: LLMContentBlock[] = []

    if (fullText) {
      allBlocks.push({ type: "text", text: fullText })
    }

    const toolUseBlocks: LLMContentBlock[] = []
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i]
      const block: LLMContentBlock = {
        type: "tool_use",
        id: `gemini_tc_${Date.now()}_${i}`,
        name: tc.name,
        input: tc.args,
      }
      toolUseBlocks.push(block)
      allBlocks.push(block)
    }

    if (toolUseBlocks.length > 0) {
      yield {
        type: "tool_start",
        tools: toolCalls.map((tc) => ({ name: tc.name, input: tc.args })),
      }
    }

    yield { type: "content_blocks", blocks: allBlocks }
    yield { type: "stop", reason: toolCalls.length > 0 ? "tool_use" : "end_turn" }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${GEMINI_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
          generationConfig: { maxOutputTokens: 16 },
          safetySettings: SAFETY_SETTINGS,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const msg = (errData as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`
        return { success: false, message: `Gemini API error: ${msg}` }
      }

      const data = await response.json()
      const text =
        data.candidates?.[0]?.content?.parts
          ?.filter((p: GeminiPart) => "text" in p)
          ?.map((p: { text: string }) => p.text)
          ?.join("") || ""

      return {
        success: true,
        message: `Connected to Gemini (${this.model}). Response: ${text.slice(0, 50)}`,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
      }
    }
  }
}
