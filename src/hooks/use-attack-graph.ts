"use client"

import { useState, useCallback, useMemo } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"
import { buildAttackGraph } from "@/lib/studio/graph-data"
import type {
  AttackGraph,
  GraphNode,
  GraphEdge,
  EntityType,
  RelationType,
} from "@/lib/studio/graph-types"
import { ALL_ENTITY_TYPES, ALL_RELATION_TYPES } from "@/lib/studio/graph-types"
import type { ProviderId } from "@/lib/providers/types"

// ── Filter state ────────────────────────────────────────────────────

export type GraphFilters = {
  entityTypes: Set<EntityType>
  relationTypes: Set<RelationType>
  providers: Set<ProviderId>
}

const ALL_PROVIDERS: ProviderId[] = ["google", "microsoft", "github", "gitlab", "slack", "aws"]

function defaultFilters(): GraphFilters {
  return {
    entityTypes: new Set(ALL_ENTITY_TYPES),
    relationTypes: new Set(ALL_RELATION_TYPES),
    providers: new Set(ALL_PROVIDERS),
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export function useAttackGraph() {
  const [filters, setFilters] = useState<GraphFilters>(defaultFilters)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const fetcher = useCallback(() => buildAttackGraph(), [])

  const { data: raw, loading, error, refetch } = useCachedQuery<AttackGraph>(
    "studio:attack-graph",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  // Apply filters
  const filtered = useMemo<AttackGraph>(() => {
    if (!raw) return { nodes: [], edges: [] }

    const nodes = raw.nodes.filter(
      (n) => filters.entityTypes.has(n.type) && filters.providers.has(n.provider)
    )
    const nodeIds = new Set(nodes.map((n) => n.id))

    const edges = raw.edges.filter(
      (e) =>
        filters.relationTypes.has(e.type) &&
        nodeIds.has(e.source) &&
        nodeIds.has(e.target)
    )

    return { nodes, edges }
  }, [raw, filters])

  // Selected node + its edges
  const selectedNode = useMemo<GraphNode | null>(() => {
    if (!selectedNodeId) return null
    return filtered.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [selectedNodeId, filtered.nodes])

  const selectedEdges = useMemo<GraphEdge[]>(() => {
    if (!selectedNodeId) return []
    return filtered.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    )
  }, [selectedNodeId, filtered.edges])

  // Filter toggles
  const toggleEntityType = useCallback((t: EntityType) => {
    setFilters((prev) => {
      const next = new Set(prev.entityTypes)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return { ...prev, entityTypes: next }
    })
  }, [])

  const toggleRelationType = useCallback((t: RelationType) => {
    setFilters((prev) => {
      const next = new Set(prev.relationTypes)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return { ...prev, relationTypes: next }
    })
  }, [])

  const toggleProvider = useCallback((p: ProviderId) => {
    setFilters((prev) => {
      const next = new Set(prev.providers)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return { ...prev, providers: next }
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  return {
    graph: filtered,
    rawGraph: raw ?? { nodes: [], edges: [] },
    loading,
    error,
    refetch,

    filters,
    toggleEntityType,
    toggleRelationType,
    toggleProvider,
    resetFilters,

    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    selectedEdges,
  }
}
