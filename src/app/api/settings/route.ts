import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/settings — Return current AI configuration (masked API key)
 */
export async function GET() {
  const cookieStore = await cookies()
  const provider = cookieStore.get("ninken_ai_provider")?.value || "anthropic"
  const model = cookieStore.get("ninken_ai_model")?.value || "claude-sonnet-4-6"
  const apiKey = cookieStore.get("ninken_ai_key")?.value
  const endpoint = cookieStore.get("ninken_ai_endpoint")?.value

  const configured = !!(apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)
  const masked = apiKey ? apiKey.slice(0, 8) + "****" + apiKey.slice(-4) : null

  return NextResponse.json({ provider, model, apiKey: masked, endpoint, configured })
}

/**
 * POST /api/settings — Sync AI settings to a server cookie
 * so API routes (like /api/ai/chat) can read the configured provider/model.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, model, apiKey, endpoint, customModel } = body

    if (!provider || !model) {
      return NextResponse.json(
        { error: "provider and model are required" },
        { status: 400 }
      )
    }

    // Store non-secret config in cookie (API key stays client-side in IndexedDB)
    const cookieStore = await cookies()
    cookieStore.set("ninken_ai_provider", provider, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
    cookieStore.set("ninken_ai_model", model, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })

    // Store API key in httpOnly cookie for server-side AI routes
    if (apiKey) {
      cookieStore.set("ninken_ai_key", apiKey, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    if (endpoint) {
      cookieStore.set("ninken_ai_endpoint", endpoint, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    if (customModel) {
      cookieStore.set("ninken_ai_custom_model", customModel, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
