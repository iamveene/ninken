import { NextResponse } from "next/server"
import { readAIConfig, createLLMAdapter } from "@/lib/llm"
import { eventBus } from "@/lib/event-bus"

export const dynamic = "force-dynamic"

const SYSTEM_PROMPT = `You are a credential and sensitive data extraction specialist. Extract the actual value from raw text.

Rules:
- Extract ONLY the actual value (the key/token/PII/URL/infra string itself)
- If multiple items present, extract the most complete one
- Output ONLY valid JSON matching the schema
- Confidence: 1.0 = exact match, 0.7 = likely, 0.4 = ambiguous

Classification:
- Credentials (API keys, tokens, passwords, etc.): type = "aws"|"gcp"|"github"|"microsoft"|"slack"|"gitlab"|"generic"
- Personally identifiable information (email addresses, SSNs, phone numbers, full names, credit cards): type = "pii", subType = "email_address"|"phone_number"|"ssn"|"full_name"|"credit_card"
- URLs (internal endpoints, admin panels, API URLs, webhook endpoints): type = "url", subType = "internal_endpoint"|"admin_panel"|"api_url"|"webhook_endpoint"
- Infrastructure details (hostnames, IP addresses, cloud ARNs, database connection strings): type = "infrastructure", subType = "hostname"|"ip_address"|"cloud_arn"|"database_connection_string"

Output schema:
{"extracted": boolean, "value": string|null, "type": "aws"|"gcp"|"github"|"microsoft"|"slack"|"gitlab"|"generic"|"pii"|"url"|"infrastructure", "subType": string|null, "confidence": number, "reason": string}`

export async function POST(request: Request) {
  const config = await readAIConfig()
  if (!config.apiKey) {
    return NextResponse.json({ error: "No LLM configured. Set up AI in Settings." }, { status: 503 })
  }

  let body: { rawText: string; patternName: string; category: string; context: { provider: string; service: string; reference: string } }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const userPrompt = `Pattern detected: ${body.patternName} (${body.category})\nSource: ${body.context.service} — ${body.context.reference}\n\nRaw text:\n---\n${body.rawText.slice(0, 4000)}\n---\n\nExtract the credential value.`

  try {
    const adapter = createLLMAdapter(config)
    let result = ""
    for await (const event of adapter.streamChat({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      maxTokens: 256,
    })) {
      if (event.type === "delta") result += event.text
    }

    // Try to extract JSON from the response (might have markdown fences)
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ extracted: false, reason: "No JSON in LLM response" })
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (parsed.extracted) {
      eventBus.publish("extraction_progress", {
        status: "completed",
        message: `Extracted ${parsed.type || "unknown"} item from ${body.patternName}`,
        itemType: parsed.type,
        confidence: parsed.confidence,
      })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    eventBus.publish("extraction_progress", {
      status: "failed",
      message: `Failed to extract from ${body.patternName}`,
    })
    return NextResponse.json({ extracted: false, reason: err instanceof Error ? err.message : "Extraction failed" })
  }
}
