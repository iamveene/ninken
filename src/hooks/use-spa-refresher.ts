"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { getAllProfiles, getProfile, updateProfileCredential } from "@/lib/token-store"
import { getProvider } from "@/lib/providers/registry"
import { isClientRefreshable } from "@/lib/providers/client-refreshable-strategy"
import { getActiveCredential } from "@/lib/providers/types"
import type { MicrosoftSpaCredential, StoredProfile } from "@/lib/providers/types"
import type { ClientRefreshableStrategy } from "@/lib/providers/client-refreshable-strategy"
import { decodeJwtPayload } from "@/lib/microsoft"

export type SpaRefreshStatus = {
  profileId: string
  status: "idle" | "refreshing" | "success" | "error"
  lastRefresh: number | null
  error: string | null
}

/**
 * React hook that manages client-side token refresh for SPA-bound credentials.
 *
 * Separate from useTokenRefresher because:
 * - SPA tokens MUST be refreshed from the browser (AADSTS9002327)
 * - The standard token-refresher calls provider.getAccessToken() server-side
 * - This hook uses strategy.clientRefresh() which runs fetch() in browser context
 *
 * Lifecycle:
 * 1. On mount, finds all profiles with SPA credentials
 * 2. For each, checks needsRefresh() and triggers clientRefresh() if needed
 * 3. After refresh: writes rotated RT to IndexedDB, pushes fresh AT to server
 * 4. Schedules next refresh based on expires_in
 */
export function useSpaRefresher(profileCount = 0) {
  const [statuses, setStatuses] = useState<Map<string, SpaRefreshStatus>>(
    new Map()
  )
  const refreshingRef = useRef(new Set<string>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const pushTokenToServer = useCallback(
    async (
      provider: string,
      accessToken: string,
      expiresIn: number,
      account?: string
    ) => {
      await fetch("/api/auth/token-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          access_token: accessToken,
          expires_in: expiresIn,
          account,
        }),
      })
    },
    []
  )

  const refreshProfile = useCallback(
    async (profile: StoredProfile) => {
      const providerId = profile.activeProvider ?? profile.provider
      const provider = getProvider(providerId)
      if (!provider) return

      const credential = getActiveCredential(profile)
      if (credential.credentialKind !== "spa") return

      // BUG-1 guard: re-verify the profile still exists in IndexedDB before
      // starting the refresh. The scan may have found this profile, but it
      // could have been deleted between scan time and now.
      const freshProfile = await getProfile(profile.id)
      if (!freshProfile) {
        console.warn(
          "[SPA Refresher] Profile", profile.id.slice(0, 8),
          "no longer exists — skipping refresh"
        )
        return
      }

      // Find the SPA strategy
      const strategies = (provider as { strategies?: unknown[] }).strategies
      // Access strategy via the provider's getAccessToken delegation pattern
      // We need to find the ClientRefreshableStrategy directly
      const spaCred = credential as MicrosoftSpaCredential

      // Prevent concurrent refreshes for the same profile
      if (refreshingRef.current.has(profile.id)) return
      refreshingRef.current.add(profile.id)

      setStatuses((prev) => {
        const next = new Map(prev)
        next.set(profile.id, {
          profileId: profile.id,
          status: "refreshing",
          lastRefresh: prev.get(profile.id)?.lastRefresh ?? null,
          error: null,
        })
        return next
      })

      try {
        // Import the SPA strategy directly for clientRefresh
        const { microsoftSpaStrategy } = await import(
          "@/lib/providers/strategies/microsoft-spa"
        )

        if (!isClientRefreshable(microsoftSpaStrategy)) {
          throw new Error("SPA strategy is not client-refreshable")
        }

        const strategy =
          microsoftSpaStrategy as ClientRefreshableStrategy<MicrosoftSpaCredential>

        // Perform the browser-side token exchange
        const result = await strategy.clientRefresh(spaCred)

        // Decode expiry from the fresh access token
        const payload = decodeJwtPayload(result.access_token)
        const expiresAt = payload?.exp
          ? (payload.exp as number)
          : Math.floor(Date.now() / 1000) + result.expires_in

        // Build updated credential with rotated refresh token + fresh access token
        const updatedCred: MicrosoftSpaCredential = {
          ...spaCred,
          refresh_token: result.refresh_token,
          access_token: result.access_token,
          expires_at: expiresAt,
        }

        // Write rotated refresh token back to IndexedDB
        await updateProfileCredential(profile.id, updatedCred)

        // BUG-1 guard: verify the profile still exists in IndexedDB before
        // pushing the token to the server cookie. If the profile was deleted
        // between the refresh start and now, pushing would create an orphaned
        // cookie that syncActiveProfile() would overwrite with a different
        // profile's credential (session hijack).
        const profileCheck = await getProfile(profile.id)
        if (!profileCheck) {
          console.warn(
            "[SPA Refresher] Profile", profile.id.slice(0, 8),
            "no longer exists in IndexedDB — skipping token push"
          )
          return
        }

        // Push fresh access token to server cookie
        await pushTokenToServer(
          providerId,
          result.access_token,
          result.expires_in,
          spaCred.account
        )

        setStatuses((prev) => {
          const next = new Map(prev)
          next.set(profile.id, {
            profileId: profile.id,
            status: "success",
            lastRefresh: Date.now(),
            error: null,
          })
          return next
        })

        // Schedule next refresh: 10 minutes before expiry
        const refreshInMs = Math.max(
          (result.expires_in - 600) * 1000,
          60_000 // minimum 1 minute
        )

        const timer = setTimeout(async () => {
          // Re-read profile from IndexedDB for latest credential
          const profiles = await getAllProfiles()
          const updated = profiles.find((p) => p.id === profile.id)
          if (updated) refreshProfile(updated)
        }, refreshInMs)

        timersRef.current.set(profile.id, timer)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "SPA refresh failed"
        setStatuses((prev) => {
          const next = new Map(prev)
          next.set(profile.id, {
            profileId: profile.id,
            status: "error",
            lastRefresh: prev.get(profile.id)?.lastRefresh ?? null,
            error: errorMsg,
          })
          return next
        })
      } finally {
        refreshingRef.current.delete(profile.id)
      }
    },
    [pushTokenToServer]
  )

  // Scan profiles and start refresh for SPA credentials
  const scan = useCallback(async () => {
    try {
      const profiles = await getAllProfiles()
      for (const profile of profiles) {
        const credential = getActiveCredential(profile)
        if (credential.credentialKind !== "spa") continue

        const spaCred = credential as MicrosoftSpaCredential

        // Import strategy to check needsRefresh
        const { microsoftSpaStrategy } = await import(
          "@/lib/providers/strategies/microsoft-spa"
        )

        if (microsoftSpaStrategy.needsRefresh(spaCred)) {
          refreshProfile(profile)
        }
      }
    } catch {
      // Non-critical — will retry on next scan
    }
  }, [refreshProfile])

  // Re-scan when profile count changes (BUG-11: pick up newly added SPA profiles)
  const lastScannedCountRef = useRef(profileCount)
  useEffect(() => {
    if (profileCount !== lastScannedCountRef.current) {
      lastScannedCountRef.current = profileCount
      scan()
    }
  }, [profileCount, scan])

  // On mount: scan immediately, then on visibility change (tab focus)
  useEffect(() => {
    // Initial scan after a short delay (let profile sync finish first)
    const initTimer = setTimeout(scan, 3000)

    // Refresh when tab becomes visible again (handles browser timer throttling)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scan()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearTimeout(initTimer)
      document.removeEventListener("visibilitychange", onVisibility)
      // Clear all scheduled refresh timers
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
      timersRef.current.clear()
    }
  }, [scan])

  return {
    spaStatuses: statuses,
    triggerRefresh: scan,
  }
}
