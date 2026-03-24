/**
 * Multi-vendor LLM system entry point.
 * Reads AI config and creates the appropriate adapter.
 */

import { readFile } from "fs/promises"
import { join } from "path"
import type { AIConfig, LLMAdapter } from "./types"
import { AnthropicAdapter } from "./adapters/anthropic"
import { OpenAIAdapter } from "./adapters/openai"
import { GeminiAdapter } from "./adapters/gemini"

export type { AIConfig, LLMAdapter, LLMTool, LLMMessage, LLMStreamEvent, LLMContentBlock, StreamChatParams } from "./types"

const CONFIG_PATH = join(/*turbopackIgnore: true*/ process.cwd(), "ai.config.json")

/** Default config when no ai.config.json exists — falls back to Anthropic via env var. */
function defaultConfig(): AIConfig {
  return {
    provider: "anthropic",
    model: process.env.NINKEN_AI_MODEL || "claude-sonnet-4-20250514",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  }
}

/**
 * Read AI configuration from ai.config.json, falling back to env vars.
 */
export async function readAIConfig(): Promise<AIConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8")
    const parsed = JSON.parse(raw) as Partial<AIConfig>

    // Merge with defaults — config file overrides env vars
    const defaults = defaultConfig()
    return {
      provider: parsed.provider || defaults.provider,
      model: parsed.model || defaults.model,
      apiKey: parsed.apiKey || defaults.apiKey,
      endpointUrl: parsed.endpointUrl,
    }
  } catch {
    // No config file — use defaults
    return defaultConfig()
  }
}

/**
 * Create the appropriate LLM adapter for the given config.
 */
export function createLLMAdapter(config: AIConfig): LLMAdapter {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicAdapter(config)
    case "openai":
    case "ollama":
    case "openrouter":
      return new OpenAIAdapter(config)
    case "gemini":
      return new GeminiAdapter(config)
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`)
  }
}
