import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getProvider } from "@/lib/providers/registry"
import type {
  ProviderId,
  ActiveTokenCookie,
  BaseCredential,
  GoogleCredential,
  MicrosoftCredential,
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

// Max cookie payload ~4000 bytes (4096 limit minus header overhead)
const MAX_COOKIE_SIZE = 4000

/**
 * Strip credential to only the fields the server-side API routes need.
 * This keeps the httpOnly cookie under the 4KB browser limit.
 * Microsoft tokens are especially large (~1500 chars refresh_token).
 */
function minimalCredential(credential: BaseCredential): BaseCredential {
  if (credential.provider === "google") {
    const c = credential as GoogleCredential
    return {
      provider: "google",
      refresh_token: c.refresh_token,
      client_id: c.client_id,
      client_secret: c.client_secret,
      token_uri: c.token_uri,
    } as GoogleCredential
  }
  if (credential.provider === "microsoft") {
    const c = credential as MicrosoftCredential
    return {
      provider: "microsoft",
      refresh_token: c.refresh_token,
      client_id: c.client_id,
      tenant_id: c.tenant_id,
      token_uri: c.token_uri,
    } as MicrosoftCredential
  }
  return credential
}

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

  // Store only essential fields in the cookie to stay under 4KB limit
  const minimal = minimalCredential(result.credential)

  const tokenCookie: ActiveTokenCookie = {
    provider: provider.id,
    credential: minimal,
  }

  const payload = JSON.stringify(tokenCookie)
  if (payload.length > MAX_COOKIE_SIZE) {
    return NextResponse.json(
      { error: `Credential too large for cookie (${payload.length} bytes). Max: ${MAX_COOKIE_SIZE}` },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()

  // httpOnly cookie — server-side token access for API routes
  cookieStore.set("ninken_token", payload, COOKIE_OPTS)

  // Non-httpOnly cookie — client can read which provider is active
  cookieStore.set("ninken_provider", provider.id, {
    ...COOKIE_OPTS,
    httpOnly: false,
  })

  return NextResponse.json({ activated: true, provider: provider.id })
}
