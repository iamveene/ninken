import { cookies } from "next/headers"
import { getTokenFromCookies, type TokenData } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getProvider } from "@/lib/providers/registry"
import { getSession, getResourceToken } from "@/lib/session-store"
import type {
  ProviderId,
  ActiveTokenCookie,
  AccessTokenCredential,
  BaseCredential,
  GoogleCredential,
  MicrosoftCredential,
  SlackCredential,
  AwsCredential,
  GcpApiKeyCredential,
} from "@/lib/providers/types"

// Ensure providers are registered
import "@/lib/providers"

/**
 * @deprecated Use getGoogleAccessToken() for Google API routes,
 * or getCredentialFromRequest() + provider.getAccessToken() for generic routes.
 * Will be removed in Phase 1.
 */
export async function getTokenFromRequest(): Promise<TokenData | null> {
  // Try new cookie format first (delegates session resolution to getCredentialFromRequest)
  const result = await getCredentialFromRequest()
  if (result) {
    if (result.provider === "google") {
      const cred = result.credential as GoogleCredential
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
  }

  // Fallback to legacy cookie format
  const cookieStore = await cookies()
  return getTokenFromCookies(cookieStore)
}

/**
 * Get a fresh Google access token from the request cookie.
 * Returns the bearer token string, or null if not authenticated as Google.
 * Preferred way to authenticate Google API routes.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "google") return null
  const provider = getProvider("google")
  if (!provider) return null
  try {
    return await provider.getAccessToken(result.credential)
  } catch {
    return null
  }
}

/**
 * Generic credential reader — returns { provider, credential } for any provider.
 * Supports two cookie modes:
 *   - Direct: cookie contains { provider, credential }
 *   - Session: cookie contains { provider, sessionId } and credential lives server-side
 */
export async function getCredentialFromRequest(): Promise<{
  provider: ProviderId
  credential: BaseCredential
} | null> {
  const cookieStore = await cookies()
  const newCookie = cookieStore.get("ninken_token")
  if (!newCookie?.value) return null

  try {
    const parsed = JSON.parse(newCookie.value) as ActiveTokenCookie
    if (!parsed.provider) return null

    // Session reference mode — resolve from server-side store
    if ("sessionId" in parsed && parsed.sessionId) {
      return getSession(parsed.sessionId)
    }

    // Direct mode — credential is in the cookie
    if ("credential" in parsed && parsed.credential) {
      return { provider: parsed.provider, credential: parsed.credential }
    }
  } catch {
    // Malformed cookie
  }

  return null
}

/**
 * Convenience: get a MicrosoftCredential from the request cookie, or null.
 */
export async function getMicrosoftCredential(): Promise<MicrosoftCredential | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "microsoft") return null
  return result.credential as MicrosoftCredential
}

/**
 * Convenience: get an access token for a specific Microsoft resource
 * from the session store's resource_tokens. Returns null if not available.
 * Only works when the cookie uses session mode (resource_tokens are too large for cookies).
 */
export async function getMicrosoftResourceToken(
  resource: string,
): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get("ninken_token")?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ActiveTokenCookie
    if (parsed.provider !== "microsoft") return null
    if ("sessionId" in parsed && parsed.sessionId) {
      return getResourceToken(parsed.sessionId, resource)
    }
  } catch { /* malformed cookie */ }
  return null
}

/**
 * Convenience: get a SlackCredential from the request cookie, or null.
 */
export async function getSlackCredential(): Promise<SlackCredential | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "slack") return null
  return result.credential as SlackCredential
}

/**
 * Convenience: get a GitHub access token from the request cookie, or null.
 * GitHub credentials are AccessTokenCredential (PATs).
 */
export async function getGitHubAccessToken(): Promise<string | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "github") return null
  return (result.credential as AccessTokenCredential).access_token
}

/**
 * Convenience: get a GitLab access token from the request cookie, or null.
 * GitLab credentials are AccessTokenCredential (PATs).
 */
export async function getGitLabAccessToken(): Promise<string | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "gitlab") return null
  return (result.credential as AccessTokenCredential).access_token
}

/**
 * Convenience: get an AwsCredential from the request cookie, or null.
 */
export async function getAwsCredential(): Promise<AwsCredential | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "aws") return null
  return result.credential as AwsCredential
}

/**
 * Convenience: get a GcpApiKeyCredential from the request cookie, or null.
 */
export async function getGcpApiKeyCredential(): Promise<GcpApiKeyCredential | null> {
  const result = await getCredentialFromRequest()
  if (!result || result.provider !== "gcp") return null
  return result.credential as GcpApiKeyCredential
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
