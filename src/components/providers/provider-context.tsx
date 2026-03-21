"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type { ProviderId, StoredProfile, BaseCredential, ServiceProvider } from "@/lib/providers/types"
import { detectProvider, getProvider } from "@/lib/providers/registry"
import "@/lib/providers" // ensure providers are registered
import {
  getAllProfiles,
  addProfile as storeAddProfile,
  removeProfile as storeRemoveProfile,
  updateProfileEmail as storeUpdateEmail,
  addTokenToProfile as storeAddToken,
  setActiveProvider as storeSetActiveProvider,
  getActiveProfileId,
} from "@/lib/token-store"
import {
  activateProfile,
  syncActiveProfile,
  migrateFromCookies,
} from "@/lib/token-sync"
import { startTokenRefresher, stopTokenRefresher } from "@/lib/token-refresher"
import { triggerFociAutoPivot } from "@/components/providers/foci-pivot-toast"
import { cacheClear } from "@/lib/cache"

type ProviderContextValue = {
  provider: ProviderId
  profile: StoredProfile | null
  profiles: StoredProfile[]
  loading: boolean
  switchProfile: (id: string) => Promise<void>
  addCredential: (raw: unknown) => Promise<{ success: boolean; error?: string }>
  removeCurrentProfile: () => Promise<void>
  updateEmail: (profileId: string, email: string) => Promise<void>
  refreshProfiles: () => Promise<void>
  linkToken: (profileId: string, raw: unknown) => Promise<{ success: boolean; error?: string }>
  switchProviderInProfile: (providerId: ProviderId) => Promise<void>
}

const ProviderContext = createContext<ProviderContextValue>({
  provider: "google",
  profile: null,
  profiles: [],
  loading: true,
  switchProfile: async () => {},
  addCredential: async () => ({ success: false, error: "Not initialized" }),
  removeCurrentProfile: async () => {},
  updateEmail: async () => {},
  refreshProfiles: async () => {},
  linkToken: async () => ({ success: false, error: "Not initialized" }),
  switchProviderInProfile: async () => {},
})

export function useProvider() {
  return useContext(ProviderContext)
}

/**
 * Detect, bootstrap, and validate a raw credential.
 * Shared by addCredential and linkToken to avoid duplication.
 */
async function resolveCredential(raw: unknown): Promise<
  | { success: true; provider: ServiceProvider; credential: BaseCredential; email?: string }
  | { success: false; error: string }
> {
  const detected = detectProvider(raw)
  if (!detected) {
    return { success: false, error: "Unrecognized credential format" }
  }

  // Async bootstrap step (e.g., Slack extracts xoxc- token from d cookie)
  let processedRaw = raw
  if (detected.bootstrapCredential) {
    try {
      processedRaw = await detected.bootstrapCredential(raw)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Credential bootstrap failed",
      }
    }
  }

  const result = detected.validateCredential(processedRaw)
  if (!result.valid) {
    return { success: false, error: result.error }
  }

  return { success: true, provider: detected, credential: result.credential, email: result.email }
}

export function ProviderContextProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<StoredProfile[]>([])
  const [profile, setProfile] = useState<StoredProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const provider: ProviderId = profile?.activeProvider ?? profile?.provider ?? "google"

  const refreshProfiles = useCallback(async () => {
    const all = await getAllProfiles()
    setProfiles(all)

    const activeId = getActiveProfileId()
    const active = all.find((p) => p.id === activeId) ?? all[0] ?? null
    setProfile(active)
  }, [])

  // Initialize: migrate legacy cookies, sync active profile
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Try migration from legacy cookies first
        await migrateFromCookies()

        // Sync active profile cookie with IndexedDB
        const synced = await syncActiveProfile()

        if (!cancelled) {
          await refreshProfiles()
          startTokenRefresher()
        }
      } catch (err) {
        // Still load profiles from IndexedDB even if activation failed
        if (!cancelled) {
          try {
            await refreshProfiles()
          } catch {
            // Truly non-critical
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      stopTokenRefresher()
    }
  }, [refreshProfiles])

  const switchProfile = useCallback(
    async (id: string) => {
      await cacheClear()
      await activateProfile(id)
      await refreshProfiles()
    },
    [refreshProfiles]
  )

  const addCredential = useCallback(
    async (
      raw: unknown
    ): Promise<{ success: boolean; error?: string }> => {
      const resolved = await resolveCredential(raw)
      if (!resolved.success) return resolved

      const newProfile = await storeAddProfile(
        resolved.provider.id,
        resolved.credential,
        resolved.email
      )

      await activateProfile(newProfile.id)
      await refreshProfiles()

      // Auto-trigger FOCI pivot probe for Microsoft FOCI credentials
      if (
        resolved.credential.provider === "microsoft" &&
        resolved.credential.credentialKind === "foci"
      ) {
        triggerFociAutoPivot()
      }

      return { success: true }
    },
    [refreshProfiles]
  )

  const removeCurrentProfile = useCallback(async () => {
    if (!profile) return
    await storeRemoveProfile(profile.id)

    // Sync to next available profile or clear
    const remaining = await getAllProfiles()
    if (remaining.length > 0) {
      await activateProfile(remaining[0].id)
    } else {
      // Clear server cookies (both legacy and new)
      await fetch("/api/auth", { method: "DELETE" }).catch(() => {})
    }

    await refreshProfiles()
  }, [profile, refreshProfiles])

  const updateEmail = useCallback(
    async (profileId: string, email: string) => {
      await storeUpdateEmail(profileId, email)
      await refreshProfiles()
    },
    [refreshProfiles]
  )

  const linkToken = useCallback(
    async (
      profileId: string,
      raw: unknown
    ): Promise<{ success: boolean; error?: string }> => {
      const resolved = await resolveCredential(raw)
      if (!resolved.success) return resolved

      await storeAddToken(profileId, resolved.provider.id, resolved.credential)

      // Re-activate profile so the newly linked token map is reflected
      await activateProfile(profileId)
      await refreshProfiles()

      return { success: true }
    },
    [refreshProfiles]
  )

  const switchProviderInProfile = useCallback(
    async (providerId: ProviderId) => {
      if (!profile) return
      await cacheClear()
      await storeSetActiveProvider(profile.id, providerId)
      await activateProfile(profile.id)
      await refreshProfiles()
    },
    [profile, refreshProfiles]
  )

  return (
    <ProviderContext
      value={{
        provider,
        profile,
        profiles,
        loading,
        switchProfile,
        addCredential,
        removeCurrentProfile,
        updateEmail,
        refreshProfiles,
        linkToken,
        switchProviderInProfile,
      }}
    >
      {children}
    </ProviderContext>
  )
}
