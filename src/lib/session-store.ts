import type { ProviderId, BaseCredential } from "@/lib/providers/types"

type StoredResourceToken = {
  access_token: string
  expires_at: number
  scope: string[]
}

type SessionEntry = {
  provider: ProviderId
  credential: BaseCredential
  expiresAt: number
  resourceTokens?: Record<string, StoredResourceToken>
}

const store = new Map<string, SessionEntry>()

/* Startup warning: NINKEN_COOKIE_SECRET should be set for cookie encryption */
if (!process.env.NINKEN_COOKIE_SECRET) {
  console.warn(
    "[ninken] NINKEN_COOKIE_SECRET is not set. " +
    "Cookie encryption is disabled — generate one with: openssl rand -hex 32"
  )
}

/** 30 days in milliseconds */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Only run full cleanup sweep every 5 minutes to avoid O(n) on every read */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = 0

/**
 * Store a credential server-side and return a session ID.
 * Used as fallback when the serialized credential exceeds the cookie size limit.
 */
export function storeSession(
  provider: ProviderId,
  credential: BaseCredential
): string {
  const sessionId = crypto.randomUUID()
  store.set(sessionId, {
    provider,
    credential,
    expiresAt: Date.now() + SESSION_TTL_MS,
  })
  return sessionId
}

/**
 * Retrieve a credential by session ID.
 * Returns null if the session doesn't exist or has expired.
 * Runs an opportunistic cleanup sweep at most once per CLEANUP_INTERVAL_MS.
 */
export function getSession(
  sessionId: string
): { provider: ProviderId; credential: BaseCredential } | null {
  const entry = store.get(sessionId)
  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    store.delete(sessionId)
    return null
  }

  maybeCleanup()

  return { provider: entry.provider, credential: entry.credential }
}

/**
 * Delete a session explicitly (e.g. on logout).
 */
export function deleteSession(sessionId: string): void {
  store.delete(sessionId)
}

/**
 * Store per-resource access tokens for a session.
 */
export function storeResourceTokens(
  sessionId: string,
  tokens: Record<string, StoredResourceToken>,
): void {
  const entry = store.get(sessionId)
  if (!entry) return
  entry.resourceTokens = tokens
}

/**
 * Get an access token for a specific resource from a session.
 * Returns null if not found or expired.
 */
export function getResourceToken(
  sessionId: string,
  resource: string,
): string | null {
  const entry = store.get(sessionId)
  if (!entry?.resourceTokens) return null

  // Exact match first
  const rt = entry.resourceTokens[resource]
  if (rt) {
    const now = Math.floor(Date.now() / 1000)
    if (rt.expires_at > now + 300) return rt.access_token
    return null
  }

  // Wildcard: *.sharepoint.com
  try {
    const url = new URL(resource)
    if (url.hostname.endsWith(".sharepoint.com")) {
      for (const [key, token] of Object.entries(entry.resourceTokens)) {
        try {
          const keyUrl = new URL(key)
          if (keyUrl.hostname.endsWith(".sharepoint.com")) {
            const now = Math.floor(Date.now() / 1000)
            if (token.expires_at > now + 300) return token.access_token
          }
        } catch {
          // Skip
        }
      }
    }
  } catch {
    // Not a URL
  }

  return null
}

/** Run a full sweep only if enough time has elapsed since the last one. */
function maybeCleanup(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [id, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(id)
    }
  }
}
