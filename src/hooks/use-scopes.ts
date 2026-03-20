"use client"

import { useCachedQuery } from "./use-cached"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import "@/lib/providers" // ensure registration

async function fetchScopes(): Promise<string[]> {
  const res = await fetch("/api/auth/scopes")
  if (!res.ok) return []
  const data = await res.json()
  return data.scopes ?? []
}

export function useScopes() {
  const { provider, loading: providerLoading } = useProvider()
  const providerConfig = getProvider(provider)
  const scopeAppMap = providerConfig?.scopeAppMap ?? {}

  const { data: scopes, loading, error } = useCachedQuery<string[]>(
    "auth:scopes",
    fetchScopes,
    { ttlMs: 5 * 60 * 1000, enabled: !providerLoading }
  )

  function hasApp(appId: string): boolean {
    if (!scopes) return false
    const requiredScopes = scopeAppMap[appId]
    if (!requiredScopes) return false
    return requiredScopes.some((s) => scopes.includes(s))
  }

  function availableApps(): string[] {
    if (!scopes) return []
    return Object.keys(scopeAppMap).filter((appId) => hasApp(appId))
  }

  return { scopes, loading, error, hasApp, availableApps }
}
