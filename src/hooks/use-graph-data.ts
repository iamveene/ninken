"use client"

import { useState, useEffect, useCallback } from "react"
import type { Node, Edge } from "@xyflow/react"
import { useProvider } from "@/components/providers/provider-context"
import { getProfileProviders } from "@/lib/providers/types"
import { getProvider } from "@/lib/providers/registry"
import { buildGraphLayout } from "@/lib/graph/layout"
import type { ProfileScopeInfo } from "@/lib/graph/types"
import "@/lib/providers"

export function useGraphData() {
  const { profiles, loading: profilesLoading } = useProvider()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    if (profilesLoading || profiles.length === 0) {
      if (!profilesLoading) {
        // No profiles loaded yet, show empty state
        setNodes([{
          id: "operator",
          type: "operator",
          position: { x: 0, y: 0 },
          data: { label: "Operator" },
          draggable: true,
        }])
        setEdges([])
        setLoading(false)
      }
      return
    }

    let cancelled = false

    async function fetchAllScopes() {
      setLoading(true)
      setError(null)

      try {
        const scopeData: ProfileScopeInfo[] = []

        // Build fetch tasks for all profile+provider combos
        const tasks: { profileId: string; provider: string; credential: any }[] = []

        for (const profile of profiles) {
          const providerIds = getProfileProviders(profile)
          for (const pid of providerIds) {
            const cred = profile.tokens?.[pid] ?? (pid === profile.provider ? profile.credential : null)
            if (!cred) continue
            tasks.push({ profileId: profile.id, provider: pid, credential: cred })
          }
        }

        // Fetch scopes in parallel
        const results = await Promise.allSettled(
          tasks.map(async (task) => {
            const res = await fetch("/api/graph/profile-scopes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: task.provider,
                credential: task.credential,
              }),
            })

            if (!res.ok) {
              const providerConfig = getProvider(task.provider as any)
              // Return a fallback with all services marked as inaccessible
              return {
                profileId: task.profileId,
                provider: task.provider,
                scopes: [],
                services: (providerConfig?.operateNavItems ?? []).map((item) => ({
                  serviceId: item.id,
                  serviceName: item.title,
                  iconName: item.iconName,
                  href: item.href,
                  active: false,
                  scopeCount: 0,
                  grantedScopes: [],
                  allScopes: providerConfig?.scopeAppMap[item.id] ?? [],
                })),
              } as ProfileScopeInfo
            }

            const data = await res.json()
            return {
              profileId: task.profileId,
              provider: task.provider,
              scopes: data.scopes,
              services: data.services,
            } as ProfileScopeInfo
          })
        )

        for (const result of results) {
          if (result.status === "fulfilled") {
            scopeData.push(result.value)
          }
        }

        if (cancelled) return

        const layout = buildGraphLayout({ profiles, scopeData })
        setNodes(layout.nodes)
        setEdges(layout.edges)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to build graph")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAllScopes()
    return () => { cancelled = true }
  }, [profiles, profilesLoading, fetchKey])

  return { nodes, edges, loading, error, refetch }
}
