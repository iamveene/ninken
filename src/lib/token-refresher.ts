import { getAllProfiles, getActiveProfileId } from "./token-store"
import { getProvider } from "./providers/registry"
import { activateProfile } from "./token-sync"
import type { StoredProfile } from "./providers/types"
import { getActiveCredential } from "./providers/types"

const DEFAULT_INTERVAL = 45 * 60 * 1000 // 45 minutes
const PREFS_KEY = "ninken_refresh_prefs"

export type RefreshStatus = {
  profileId: string
  lastRefresh: number | null
  lastError: string | null
  nextRefresh: number
  autoRefreshEnabled: boolean
}

type RefreshEvent = {
  type: "refreshed" | "failed" | "started"
  profileId: string
  error?: string
}

type RefreshPrefs = Record<string, { autoRefresh: boolean }>

type Listener = (event: RefreshEvent) => void

let intervalId: ReturnType<typeof setInterval> | null = null
let currentInterval = DEFAULT_INTERVAL
const statuses = new Map<string, RefreshStatus>()
const listeners = new Set<Listener>()

function loadPrefs(): RefreshPrefs {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs: RefreshPrefs): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function emit(event: RefreshEvent) {
  listeners.forEach((fn) => fn(event))
}

async function refreshProfile(profile: StoredProfile): Promise<void> {
  const activeProviderId = profile.activeProvider ?? profile.provider
  const provider = getProvider(activeProviderId)
  if (!provider) return

  const credential = getActiveCredential(profile)

  // Skip non-refreshable credentials (raw access tokens, etc.)
  if (provider.canRefresh && !provider.canRefresh(credential)) {
    return
  }

  const status = statuses.get(profile.id)
  if (status && !status.autoRefreshEnabled) return

  emit({ type: "started", profileId: profile.id })

  try {
    await provider.getAccessToken(credential)

    // If this is the active profile, re-activate to update the server cookie
    const activeId = getActiveProfileId()
    if (activeId === profile.id) {
      await activateProfile(profile.id)
    }

    const now = Date.now()
    statuses.set(profile.id, {
      profileId: profile.id,
      lastRefresh: now,
      lastError: null,
      nextRefresh: now + currentInterval,
      autoRefreshEnabled: status?.autoRefreshEnabled ?? true,
    })

    emit({ type: "refreshed", profileId: profile.id })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Refresh failed"
    const now = Date.now()
    statuses.set(profile.id, {
      profileId: profile.id,
      lastRefresh: status?.lastRefresh ?? null,
      lastError: errorMsg,
      nextRefresh: now + currentInterval,
      autoRefreshEnabled: status?.autoRefreshEnabled ?? true,
    })

    emit({ type: "failed", profileId: profile.id, error: errorMsg })
  }
}

async function tick() {
  try {
    const profiles = await getAllProfiles()
    const prefs = loadPrefs()

    for (const profile of profiles) {
      const autoRefresh = prefs[profile.id]?.autoRefresh ?? true
      const existing = statuses.get(profile.id)

      if (!existing) {
        statuses.set(profile.id, {
          profileId: profile.id,
          lastRefresh: null,
          lastError: null,
          nextRefresh: Date.now(),
          autoRefreshEnabled: autoRefresh,
        })
      } else {
        existing.autoRefreshEnabled = autoRefresh
      }

      if (autoRefresh) {
        await refreshProfile(profile)
      }
    }
  } catch {
    // Non-critical - will retry next tick
  }
}

export function startTokenRefresher(intervalMs?: number): void {
  if (intervalId) return // Already running

  currentInterval = intervalMs ?? DEFAULT_INTERVAL

  // Run first tick after a short delay to avoid blocking init
  setTimeout(() => tick(), 5000)

  intervalId = setInterval(tick, currentInterval)
}

export function stopTokenRefresher(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function getRefreshStatuses(): RefreshStatus[] {
  return Array.from(statuses.values())
}

export function setAutoRefresh(profileId: string, enabled: boolean): void {
  const prefs = loadPrefs()
  prefs[profileId] = { autoRefresh: enabled }
  savePrefs(prefs)

  const status = statuses.get(profileId)
  if (status) {
    status.autoRefreshEnabled = enabled
  }
}

export async function refreshNow(profileId?: string): Promise<void> {
  if (profileId) {
    const profiles = await getAllProfiles()
    const profile = profiles.find((p) => p.id === profileId)
    if (profile) await refreshProfile(profile)
  } else {
    await tick()
  }
}

export function onRefreshEvent(callback: Listener): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function isRefresherRunning(): boolean {
  return intervalId !== null
}
