import type { ProviderId, BaseCredential } from "@/lib/providers/types"

type SessionEntry = {
  provider: ProviderId
  credential: BaseCredential
  expiresAt: number
}

const store = new Map<string, SessionEntry>()

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
