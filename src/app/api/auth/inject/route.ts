import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { detectProvider } from "@/lib/providers/registry"
import { storeSession } from "@/lib/session-store"
import { eventBus } from "@/lib/event-bus"
import type { ActiveTokenCookie } from "@/lib/providers/types"

// Must import providers/index to trigger auto-registration
import "@/lib/providers"

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

/**
 * Conservative cookie size threshold.
 * Total cookie limit is ~4096 bytes including header overhead.
 * If the direct payload exceeds this, fall back to a server-side session.
 */
const COOKIE_SIZE_THRESHOLD = 3800

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/inject — Accept raw credential JSON, detect provider, validate,
 * set cookie, publish SSE event for UI auto-import.
 *
 * Request body: { credential: <raw JSON> }
 * Response: { success: true, provider: string, email?: string }
 *        or { success: false, error: string }
 */
export async function POST(request: Request) {
  try {
    let body: { credential?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const raw = body.credential
    if (!raw) {
      return NextResponse.json(
        { success: false, error: "Missing credential" },
        { status: 400 },
      )
    }

    // Detect provider from credential shape
    const provider = detectProvider(raw)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Unrecognized credential format" },
        { status: 400 },
      )
    }

    // Async bootstrap step (e.g., Slack extracts xoxc- token from d cookie)
    let processedRaw: unknown = raw
    if (provider.bootstrapCredential) {
      try {
        processedRaw = await provider.bootstrapCredential(raw)
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            error:
              err instanceof Error
                ? err.message
                : "Credential bootstrap failed",
          },
          { status: 400 },
        )
      }
    }

    // Validate
    const result = provider.validateCredential(processedRaw)
    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      )
    }

    // Store only essential fields to minimise size
    const minimal = provider.minimalCredential(result.credential)

    // Two-tier storage: try direct cookie first, fall back to server-side session
    const directPayload = JSON.stringify({
      provider: provider.id,
      credential: minimal,
    } satisfies ActiveTokenCookie)

    let cookiePayload: string

    if (directPayload.length < COOKIE_SIZE_THRESHOLD) {
      // Direct mode — credential fits in the cookie
      cookiePayload = directPayload
    } else {
      // Session mode — store credential server-side, cookie holds only a reference
      const sessionId = storeSession(provider.id, minimal)
      cookiePayload = JSON.stringify({
        provider: provider.id,
        sessionId,
      } satisfies ActiveTokenCookie)
    }

    const cookieStore = await cookies()

    // httpOnly cookie — server-side token access for API routes
    cookieStore.set("ninken_token", cookiePayload, COOKIE_OPTS)

    // Non-httpOnly cookie — client can read which provider is active
    cookieStore.set("ninken_provider", provider.id, {
      ...COOKIE_OPTS,
      httpOnly: false,
    })

    // Publish SSE event so the UI auto-imports the credential
    eventBus.publish("credential_injected", {
      provider: provider.id,
      email: result.email || null,
      credential: processedRaw as Record<string, unknown>,
    })

    return NextResponse.json({
      success: true,
      provider: provider.id,
      email: result.email || null,
      // Return cookie value so MCP server can capture it for subsequent requests
      _cookie: cookiePayload,
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Injection failed",
      },
      { status: 500 },
    )
  }
}
