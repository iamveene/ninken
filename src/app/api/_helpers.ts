import { cookies } from "next/headers"
import { getTokenFromCookies, type TokenData } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getProvider } from "@/lib/providers/registry"
import type { ProviderId, ActiveTokenCookie, GoogleCredential } from "@/lib/providers/types"

// Ensure providers are registered
import "@/lib/providers"

export async function getTokenFromRequest(): Promise<TokenData | null> {
  const cookieStore = await cookies()

  // Try new cookie format first
  const newCookie = cookieStore.get("ninken_token")
  if (newCookie?.value) {
    try {
      const parsed = JSON.parse(newCookie.value) as ActiveTokenCookie
      if (parsed.provider === "google") {
        const cred = parsed.credential as GoogleCredential
        return {
          token: cred.token,
          refresh_token: cred.refresh_token,
          client_id: cred.client_id,
          client_secret: cred.client_secret,
          token_uri: cred.token_uri,
        }
      }
      // Non-Google provider — Google API routes should 401
      return null
    } catch {
      // Malformed new cookie — fall through to legacy
    }
  }

  // Fallback to legacy cookie format
  return getTokenFromCookies(cookieStore)
}

export async function getProviderFromRequest(): Promise<ProviderId | null> {
  const cookieStore = await cookies()
  const providerCookie = cookieStore.get("ninken_provider")
  if (!providerCookie?.value) return null
  return providerCookie.value as ProviderId
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function serverError(error: unknown, providerId?: ProviderId) {
  // Try provider-specific error parsing first
  if (providerId) {
    const provider = getProvider(providerId)
    if (provider) {
      const parsed = provider.parseApiError(error)
      if (parsed) {
        return NextResponse.json(
          { error: parsed.message },
          { status: parsed.status }
        )
      }
    }
  }

  // Fallback: Google-style error parsing (backward compat)
  if (error && typeof error === "object" && "code" in error) {
    const apiError = error as { code: number; message?: string }
    const status = apiError.code
    if (status >= 400 && status < 600) {
      return NextResponse.json(
        { error: apiError.message || "Request failed" },
        { status }
      )
    }
  }

  if (error && typeof error === "object") {
    const err = error as { errors?: { message?: string; reason?: string }[]; message?: string }
    if (Array.isArray(err.errors) && err.errors.length > 0) {
      const msg = err.errors[0].message || err.message || "Request failed"
      const isInvalid = msg.toLowerCase().includes("invalid") || err.errors[0].reason === "notFound"
      return NextResponse.json(
        { error: msg },
        { status: isInvalid ? 400 : 500 }
      )
    }
    if (err.message && /\binvalid\b/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }

  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ error: message }, { status: 500 })
}
