"use client"

import {
  getProfile,
  getAllProfiles,
  addProfile,
  setActiveProfileId,
  getActiveProfileId,
  clearAllProfiles,
} from "./token-store"
import { detectProvider } from "./providers"
import type { StoredProfile } from "./providers/types"
import { getActiveCredential } from "./providers/types"
import { cacheClear } from "./cache"

/**
 * Activate a profile: read from IndexedDB, POST credential to server
 * so the httpOnly cookie is set for API route access.
 */
export async function activateProfile(profileId: string): Promise<void> {
  const previousActiveId = getActiveProfileId()

  const profile = await getProfile(profileId)
  if (!profile) throw new Error("Profile not found")

  const activeProvider = profile.activeProvider ?? profile.provider
  const activeCredential = getActiveCredential(profile)

  // For SPA credentials, use token-push instead of activate — but ONLY if
  // the IndexedDB credential has a valid, non-expired access_token.
  // SPA tokens can't be refreshed server-side, so the access_token in IndexedDB
  // is the only source of truth — set by useSpaRefresher.
  //
  // BUG-5 fix: If the AT is missing, expired, or has unknown expiry, do NOT
  // push it to the cookie — that would overwrite a potentially valid cookie
  // (set by a recent SPA refresh) with a stale/empty token. Instead, just set
  // the profile ID and let useSpaRefresher handle getting a fresh token.
  if (activeCredential.credentialKind === "spa") {
    const spaCred = activeCredential as { access_token?: string; expires_at?: number }
    const now = Math.floor(Date.now() / 1000)

    // Only push if we have BOTH a non-empty AT AND a known future expiry
    const hasValidAt = !!(
      spaCred.access_token &&
      spaCred.expires_at &&
      spaCred.expires_at > now + 60
    )

    if (hasValidAt) {
      // Use token-push to set cookie with the access_token directly
      const pushRes = await fetch("/api/auth/token-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeProvider,
          access_token: spaCred.access_token,
          expires_in: spaCred.expires_at! - now,
          account: (activeCredential as { account?: string }).account,
        }),
      })
      if (pushRes.ok) {
        setActiveProfileId(profileId)
        return
      }
    }

    // No valid AT or push failed — set profile ID but skip cookie write.
    // useSpaRefresher will handle the refresh and push a fresh token.
    setActiveProfileId(profileId)
    return
  }

  const res = await fetch("/api/auth/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: activeProvider,
      credential: activeCredential,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to activate" }))
    throw new Error(data.error || "Failed to activate profile")
  }

  // Clear stale cache when switching to a different profile
  if (previousActiveId && previousActiveId !== profileId) {
    await cacheClear()
  }

  setActiveProfileId(profileId)
}

/**
 * Ensure the server cookie matches the current active profile.
 * Call this on mount to sync state after page reload.
 */
export async function syncActiveProfile(): Promise<StoredProfile | null> {
  const activeId = getActiveProfileId()
  if (!activeId) {
    // No active profile — check if there are any profiles at all
    const profiles = await getAllProfiles()
    if (profiles.length === 0) return null
    // Auto-activate the first one
    await activateProfile(profiles[0].id)
    return profiles[0]
  }

  const profile = await getProfile(activeId)
  if (!profile) {
    // Active ID points to a removed profile — pick first available
    const profiles = await getAllProfiles()
    if (profiles.length === 0) return null
    await activateProfile(profiles[0].id)
    return profiles[0]
  }

  // Re-sync cookie (in case it expired or was cleared)
  await activateProfile(profile.id)
  return profile
}

/**
 * One-time migration from legacy cookie-based storage to IndexedDB.
 * Returns true if migration occurred.
 */
export async function migrateFromCookies(): Promise<boolean> {
  try {
    // Skip migration if IndexedDB already has profiles
    const existing = await getAllProfiles()
    if (existing.length > 0) return false

    // Check if legacy profiles exist on the server
    const res = await fetch("/api/auth/export")
    if (!res.ok) return false

    const data = await res.json()
    const legacyProfiles: Array<{
      email?: string
      refresh_token: string
      client_id: string
      client_secret: string
      token?: string
      token_uri?: string
    }> = data.profiles

    if (!Array.isArray(legacyProfiles) || legacyProfiles.length === 0) {
      return false
    }

    // Clear any existing IndexedDB profiles to avoid duplicates
    await clearAllProfiles()

    // Import each legacy profile
    let firstProfile: StoredProfile | null = null
    for (const legacy of legacyProfiles) {
      const provider = detectProvider(legacy)
      if (!provider) continue

      const result = provider.validateCredential(legacy)
      if (!result.valid) continue

      const profile = await addProfile(
        provider.id,
        result.credential,
        legacy.email || result.email
      )
      if (!firstProfile) firstProfile = profile
    }

    // Only proceed if at least one profile was successfully migrated
    if (!firstProfile) return false

    // Activate the first profile (sets the new cookie format)
    await activateProfile(firstProfile.id)

    // Clear legacy cookies on the server
    await fetch("/api/auth/export", { method: "DELETE" })

    return true
  } catch {
    return false
  }
}
