"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type { ProviderId, StoredProfile } from "@/lib/providers/types"
import { detectProvider, getProvider } from "@/lib/providers/registry"
import "@/lib/providers" // ensure providers are registered
import {
  getAllProfiles,
  addProfile as storeAddProfile,
  removeProfile as storeRemoveProfile,
  updateProfileEmail as storeUpdateEmail,
  getActiveProfileId,
} from "@/lib/token-store"
import {
  activateProfile,
  syncActiveProfile,
  migrateFromCookies,
} from "@/lib/token-sync"
import { startTokenRefresher, stopTokenRefresher } from "@/lib/token-refresher"
import { triggerFociAutoPivot } from "@/components/providers/foci-pivot-toast"

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
})

export function useProvider() {
  return useContext(ProviderContext)
}

export function ProviderContextProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<StoredProfile[]>([])
  const [profile, setProfile] = useState<StoredProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const provider: ProviderId = profile?.provider ?? "google"

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
      await activateProfile(id)
      await refreshProfiles()
    },
    [refreshProfiles]
  )

  const addCredential = useCallback(
    async (
      raw: unknown
    ): Promise<{ success: boolean; error?: string }> => {
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
            error:
              err instanceof Error ? err.message : "Credential bootstrap failed",
          }
        }
      }

      const result = detected.validateCredential(processedRaw)
      if (!result.valid) {
        return { success: false, error: result.error }
      }

      const newProfile = await storeAddProfile(
        detected.id,
        result.credential,
        result.email
      )

      await activateProfile(newProfile.id)
      await refreshProfiles()

      // Auto-trigger FOCI pivot probe for Microsoft FOCI credentials
      if (
        result.credential.provider === "microsoft" &&
        result.credential.credentialKind === "foci"
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
      }}
    >
      {children}
    </ProviderContext>
  )
}
