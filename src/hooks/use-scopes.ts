"use client"

import { useCachedQuery } from "./use-cached"

const SCOPE_APP_MAP: Record<string, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "https://mail.google.com/",
  ],
  drive: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
  ],
  buckets: [
    "https://www.googleapis.com/auth/devstorage.full_control",
    "https://www.googleapis.com/auth/devstorage.read_write",
    "https://www.googleapis.com/auth/devstorage.read_only",
    "https://www.googleapis.com/auth/cloud-platform",
  ],
  calendar: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ],
  directory: [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.user",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
    "https://www.googleapis.com/auth/admin.directory.group",
  ],
}

export type AppId = keyof typeof SCOPE_APP_MAP

async function fetchScopes(): Promise<string[]> {
  const res = await fetch("/api/auth/scopes")
  if (!res.ok) return []
  const data = await res.json()
  return data.scopes ?? []
}

export function useScopes() {
  const { data: scopes, loading, error } = useCachedQuery<string[]>(
    "auth:scopes",
    fetchScopes,
    { ttlMs: 5 * 60 * 1000 } // cache for 5 minutes
  )

  function hasApp(appId: AppId): boolean {
    if (!scopes) return false
    const requiredScopes = SCOPE_APP_MAP[appId]
    if (!requiredScopes) return false
    return requiredScopes.some((s) => scopes.includes(s))
  }

  function availableApps(): AppId[] {
    if (!scopes) return []
    return (Object.keys(SCOPE_APP_MAP) as AppId[]).filter((appId) => hasApp(appId))
  }

  return { scopes, loading, error, hasApp, availableApps }
}
