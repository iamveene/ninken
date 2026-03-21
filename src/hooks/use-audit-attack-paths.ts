"use client"

import { useMemo } from "react"
import { useAuditUsers, useAuditGroups, useAuditRoles, useAuditDelegation } from "@/hooks/use-audit"
import { buildAuditAttackPaths, type AttackPathResult } from "@/lib/audit/attack-path-builder"

export function useAuditAttackPaths() {
  const { data: usersData, loading: usersLoading, error: usersError } = useAuditUsers()
  const { data: groupsData, loading: groupsLoading, error: groupsError } = useAuditGroups()
  const { data: rolesData, loading: rolesLoading, error: rolesError } = useAuditRoles()
  const { delegations, loading: delegLoading, error: delegError } = useAuditDelegation()

  const loading = usersLoading || groupsLoading || rolesLoading || delegLoading

  // Combine errors — show the first non-null error
  const error = usersError || groupsError || rolesError || delegError || null

  const result = useMemo<AttackPathResult>(() => {
    if (loading) {
      return { nodes: [], edges: [], highlightedPaths: [] }
    }
    return buildAuditAttackPaths(
      usersData.users,
      groupsData.groups,
      rolesData.roles,
      delegations,
    )
  }, [loading, usersData.users, groupsData.groups, rolesData.roles, delegations])

  return {
    nodes: result.nodes,
    edges: result.edges,
    highlightedPaths: result.highlightedPaths,
    loading,
    error,
  }
}
