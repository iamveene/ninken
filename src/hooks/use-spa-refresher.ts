"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { getAllProfiles, getProfile, updateProfileCredential } from "@/lib/token-store"
import { getProvider } from "@/lib/providers/registry"
import { isClientRefreshable } from "@/lib/providers/client-refreshable-strategy"
import { getActiveCredential } from "@/lib/providers/types"
import type { MicrosoftSpaCredential, StoredProfile, ResourceTokenPayload } from "@/lib/providers/types"
import type { ClientRefreshableStrategy } from "@/lib/providers/client-refreshable-strategy"
import { decodeJwtPayload } from "@/lib/microsoft"
import { getSpaClient } from "@/lib/providers/spa-client-registry"

export type SpaRefreshStatus = {
  profileId: string
  status: "idle" | "refreshing" | "success" | "error" | "needs-reextraction"
  lastRefresh: number | null
  error: string | null
  /** The origin URL for re-extraction (set when status is "needs-reextraction") */
  reextractionOrigin?: string
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
  // Profiles that failed with origin-bound errors — skip until next manual import
  const originBoundRef = useRef(new Set<string>())

  const pushTokenToServer = useCallback(
    async (
      provider: string,
      accessToken: string,
      expiresIn: number,
      account?: string,
      resourceTokens?: Record<string, ResourceTokenPayload>,
    ) => {
      await fetch("/api/auth/token-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          access_token: accessToken,
          expires_in: expiresIn,
          account,
          ...(resourceTokens ? { resource_tokens: resourceTokens } : {}),
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

      // Already failed with origin-bound CORS — skip until re-import
      if (originBoundRef.current.has(profile.id)) return

      // Pre-flight origin check: if the SPA client's origin doesn't match the
      // current window origin, the CORS fetch WILL fail. Skip it entirely to
      // avoid noisy console errors.
      const spaCred = credential as MicrosoftSpaCredential
      const preflightClient = getSpaClient(spaCred.client_id)
      if (preflightClient?.origin && typeof window !== "undefined") {
        if (preflightClient.origin !== window.location.origin) {
          originBoundRef.current.add(profile.id)
          setStatuses((prev) => {
            const next = new Map(prev)
            next.set(profile.id, {
              profileId: profile.id,
              status: "needs-reextraction",
              lastRefresh: null,
              error: "SPA token is origin-bound (pre-flight check)",
              reextractionOrigin: preflightClient.origin,
            })
            return next
          })
          window.dispatchEvent(
            new CustomEvent("spa-reextraction-needed", {
              detail: {
                profileId: profile.id,
                clientId: spaCred.client_id,
                origin: preflightClient.origin,
                clientName: preflightClient.name,
              },
            }),
          )
          return
        }
      }

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

        let resourceTokensPayload: Record<string, ResourceTokenPayload> | undefined
        if (updatedCred.resource_tokens) {
          resourceTokensPayload = {}
          for (const [resource, rt] of Object.entries(updatedCred.resource_tokens)) {
            resourceTokensPayload[resource] = {
              access_token: rt.access_token,
              expires_in: rt.expires_at
                ? rt.expires_at - Math.floor(Date.now() / 1000)
                : 3600,
              scope: rt.scope,
            }
          }
        }

        await pushTokenToServer(
          providerId,
          result.access_token,
          result.expires_in,
          spaCred.account,
          resourceTokensPayload,
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
        const isOriginBound =
          (err instanceof Error && "originBound" in err && (err as Error & { originBound?: boolean }).originBound) ||
          errorMsg.includes("AADSTS9002313") ||
          errorMsg.includes("AADSTS9002327")

        if (isOriginBound) {
          originBoundRef.current.add(profile.id)
          const clientEntry = getSpaClient(spaCred.client_id)
          setStatuses((prev) => {
            const next = new Map(prev)
            next.set(profile.id, {
              profileId: profile.id,
              status: "needs-reextraction",
              lastRefresh: prev.get(profile.id)?.lastRefresh ?? null,
              error: errorMsg,
              reextractionOrigin: clientEntry?.origin,
            })
            return next
          })
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("spa-reextraction-needed", {
                detail: {
                  profileId: profile.id,
                  clientId: spaCred.client_id,
                  origin: clientEntry?.origin,
                  clientName: clientEntry?.name,
                },
              }),
            )
          }
        } else {
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
        }
      } finally {
        refreshingRef.current.delete(profile.id)
      }
    },
    [pushTokenToServer]
  )

  // Scan profiles and start refresh for SPA credentials.
  // Only refreshes profiles whose active provider is "microsoft" to avoid
  // CORS noise from attempting MS token refresh on non-Microsoft pages.
  const scan = useCallback(async () => {
    try {
      const profiles = await getAllProfiles()
      for (const profile of profiles) {
        // Skip profiles that aren't actively using Microsoft provider
        const activeProvider = profile.activeProvider ?? profile.provider
        if (activeProvider !== "microsoft") continue

        const credential = getActiveCredential(profile)
        if (credential.credentialKind !== "spa") continue

        const spaCred = credential as MicrosoftSpaCredential

        // Pre-flight origin check: skip known origin-bound tokens to avoid CORS noise
        if (originBoundRef.current.has(profile.id)) continue
        const clientEntry = getSpaClient(spaCred.client_id)
        if (clientEntry?.origin && typeof window !== "undefined" && clientEntry.origin !== window.location.origin) {
          // Origin mismatch: route through refreshProfile to register in originBoundRef and dispatch spa-reextraction-needed
          refreshProfile(profile)
          continue
        }

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
  // Also reset origin-bound back-off so re-imported tokens get a fresh attempt
  const lastScannedCountRef = useRef(profileCount)
  useEffect(() => {
    if (profileCount !== lastScannedCountRef.current) {
      lastScannedCountRef.current = profileCount
      originBoundRef.current.clear()
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
