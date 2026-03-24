"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import type { ProviderId, StoredProfile, BaseCredential, ServiceProvider } from "@/lib/providers/types"
import { detectProvider, getProvider } from "@/lib/providers/registry"
import { getProviderFromPathname } from "@/lib/providers/routes"
import "@/lib/providers" // ensure providers are registered
import {
  getAllProfiles,
  addProfile as storeAddProfile,
  removeProfile as storeRemoveProfile,
  updateProfileEmail as storeUpdateEmail,
  addTokenToProfile as storeAddToken,
  setActiveProvider as storeSetActiveProvider,
  getActiveProfileId,
  updateProfileCredential as storeUpdateCredential,
} from "@/lib/token-store"
import {
  activateProfile,
  syncActiveProfile,
  migrateFromCookies,
} from "@/lib/token-sync"
import { startTokenRefresher, stopTokenRefresher } from "@/lib/token-refresher"
import { triggerFociAutoPivot } from "@/components/providers/foci-pivot-toast"
import { cacheClear } from "@/lib/cache"
import { useSpaRefresher } from "@/hooks/use-spa-refresher"
import { useEvents } from "@/hooks/use-events"

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

// getProviderFromPathname imported from @/lib/providers/routes

export function ProviderContextProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<StoredProfile[]>([])
  const [profile, setProfile] = useState<StoredProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  // Capture the initial pathname at mount time for route-based provider switching (HI-16).
  // Using a ref avoids re-running the init effect on every in-layout navigation.
  const initialPathnameRef = useRef(pathname)

  const provider: ProviderId = profile?.activeProvider ?? profile?.provider ?? "google"

  // SPA token proxy: client-side refresh for browser-bound tokens (OWA, Teams Web, etc.)
  useSpaRefresher(profiles.length)

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
        await syncActiveProfile()

        if (!cancelled) {
          await refreshProfiles()

          // HI-16 fix: Auto-switch to the correct provider if the URL belongs
          // to a different provider's route group. This handles direct URL
          // navigation (bookmarks, links) where the server cookie may have the
          // wrong provider's token.
          const routeProvider = getProviderFromPathname(initialPathnameRef.current)
          if (routeProvider) {
            const activeId = getActiveProfileId()
            const all = await getAllProfiles()
            const current = all.find((p) => p.id === activeId)
            const currentProvider = current?.activeProvider ?? current?.provider

            if (currentProvider !== routeProvider) {
              // Find a profile for the route's provider
              const targetProfile = all.find((p) => p.provider === routeProvider)
              if (targetProfile) {
                await activateProfile(targetProfile.id)
                await refreshProfiles()
              }
            }
          }

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

      // BUG-10: Check for existing profile with same email + provider to avoid duplicates
      let profileId: string
      if (resolved.email) {
        const existingProfiles = await getAllProfiles()
        const existing = existingProfiles.find(
          (p) => p.email === resolved.email && p.provider === resolved.provider.id
        )
        if (existing) {
          // Update the existing profile's credential instead of creating a new one
          await storeUpdateCredential(existing.id, resolved.credential)
          profileId = existing.id
        } else {
          const newProfile = await storeAddProfile(
            resolved.provider.id,
            resolved.credential,
            resolved.email
          )
          profileId = newProfile.id
        }
      } else {
        const newProfile = await storeAddProfile(
          resolved.provider.id,
          resolved.credential,
          resolved.email
        )
        profileId = newProfile.id
      }

      await activateProfile(profileId)
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

  // Auto-import credentials injected via MCP /api/auth/inject SSE events
  useEvents({
    credential_injected: async (event) => {
      const cred = event.payload?.credential
      if (cred) {
        await addCredential(cred)
      }
    },
  })

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
