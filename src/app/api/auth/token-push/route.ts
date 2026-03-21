import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { decodeJwtPayload } from "@/lib/microsoft"
import type { ProviderId, ActiveTokenCookie } from "@/lib/providers/types"

// Must import providers/index to trigger auto-registration
import "@/lib/providers"

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/token-push
 *
 * Lightweight endpoint for SPA token proxy: receives a fresh access token
 * from the browser and updates the server cookie. Unlike /api/auth/activate,
 * this does NOT re-validate the full credential — the token is already
 * exchanged by the browser's SPA refresh.
 */
export async function POST(request: Request) {
  let body: {
    provider?: string
    access_token?: string
    expires_in?: number
    account?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { provider: providerId, access_token, expires_in, account } = body

  if (!providerId || typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing provider" }, { status: 400 })
  }

  if (!access_token || typeof access_token !== "string") {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 })
  }

  // Validate the access token is a real JWT with a future expiry
  const payload = decodeJwtPayload(access_token)
  if (!payload) {
    return NextResponse.json({ error: "Invalid JWT" }, { status: 400 })
  }

  const exp = payload.exp as number | undefined
  const now = Math.floor(Date.now() / 1000)
  if (exp && exp < now) {
    return NextResponse.json({ error: "Token already expired" }, { status: 400 })
  }

  // Build the cookie payload — store as an access-token credential so
  // API routes can use it directly without any server-side refresh.
  const credential = {
    provider: providerId as ProviderId,
    credentialKind: "access-token" as const,
    access_token,
    expires_at: exp || now + (expires_in || 3600),
    email: (payload.preferred_username as string) || (payload.upn as string) || account || "",
  }

  const cookiePayload = JSON.stringify({
    provider: providerId as ProviderId,
    credential,
  } satisfies ActiveTokenCookie)

  const cookieStore = await cookies()
  cookieStore.set("ninken_token", cookiePayload, COOKIE_OPTS)
  cookieStore.set("ninken_provider", providerId, {
    ...COOKIE_OPTS,
    httpOnly: false,
  })

  return NextResponse.json({
    pushed: true,
    provider: providerId,
    expiresIn: exp ? exp - now : expires_in || 3600,
  })
}
