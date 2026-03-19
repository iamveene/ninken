import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getProvider } from "@/lib/providers/registry"
import { storeSession } from "@/lib/session-store"
import type {
  ProviderId,
  ActiveTokenCookie,
} from "@/lib/providers/types"

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

export async function POST(request: Request) {
  let body: { provider?: string; credential?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { provider: providerId, credential } = body

  if (!providerId || typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing provider" }, { status: 400 })
  }

  const provider = getProvider(providerId as ProviderId)
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 400 }
    )
  }

  const result = provider.validateCredential(credential)
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 })
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

  return NextResponse.json({ activated: true, provider: provider.id })
}
