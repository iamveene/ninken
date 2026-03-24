import { NextResponse } from "next/server"
import { createLLMAdapter } from "@/lib/llm"
import type { AIConfig } from "@/lib/llm/types"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let config: AIConfig
  try {
    config = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!config.provider || !config.model) {
    return NextResponse.json({ error: "Missing provider or model" }, { status: 400 })
  }

  try {
    const adapter = createLLMAdapter(config)
    const result = await adapter.testConnection()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : "Connection test failed",
    })
  }
}
