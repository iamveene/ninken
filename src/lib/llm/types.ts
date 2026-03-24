/**
 * Multi-vendor LLM abstraction types.
 * Provider-agnostic interfaces for chat, tools, and streaming.
 */

export type LLMProviderId = "anthropic" | "openai" | "gemini" | "ollama" | "openrouter"

export type AIConfig = {
  provider: LLMProviderId
  model: string
  apiKey?: string
  endpointUrl?: string
}

export type LLMMessage = {
  role: "user" | "assistant"
  content: string | LLMContentBlock[]
}

export type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }

export type LLMTool = {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, unknown>
    required: string[]
  }
}

export type LLMStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; tools: { name: string; input: Record<string, unknown> }[] }
  | { type: "content_blocks"; blocks: LLMContentBlock[] }
  | { type: "stop"; reason: string }
  | { type: "error"; error: string }

export type StreamChatParams = {
  messages: LLMMessage[]
  systemPrompt: string
  tools: LLMTool[]
  maxTokens: number
}

export interface LLMAdapter {
  readonly id: string
  streamChat(params: StreamChatParams): AsyncGenerator<LLMStreamEvent>
  testConnection(): Promise<{ success: boolean; message: string }>
}

// --- UI constants for Settings page ---

export const LLM_PROVIDER_LABELS: Record<LLMProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
  ollama: "Ollama (Local)",
  openrouter: "OpenRouter",
}

export const PROVIDER_MODELS: Record<LLMProviderId, { id: string; name: string; recommended?: boolean }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", recommended: true },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", recommended: true },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", recommended: true },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
  ],
  ollama: [
    { id: "llama3.1:8b", name: "Llama 3.1 8B", recommended: true },
    { id: "gemma3:4b", name: "Gemma 3 4B" },
    { id: "qwen2.5-coder:14b", name: "Qwen 2.5 Coder 14B" },
    { id: "phi4", name: "Phi-4" },
    { id: "mistral", name: "Mistral" },
    { id: "deepseek-coder", name: "DeepSeek Coder" },
  ],
  openrouter: [
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (via OpenRouter)", recommended: true },
    { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku (via OpenRouter)" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (via OpenRouter)" },
    { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)" },
  ],
}

export function getRecommendedModel(provider: LLMProviderId): string {
  const models = PROVIDER_MODELS[provider]
  const rec = models.find((m) => m.recommended)
  return rec?.id ?? models[0]?.id ?? ""
}
