"use client"

import { useMemo } from "react"
import { useAuthenticationMethods, useRiskyUsers, useCrossTenantAccess, useConditionalAccessPolicies, useServicePrincipals } from "@/hooks/use-m365-audit"
import { useEntraGroups, useEntraRoles } from "@/hooks/use-entra"
import { buildM365AttackPaths } from "@/lib/audit/m365-attack-path-builder"
import type { AttackPathResult } from "@/lib/audit/attack-path-builder"

export function useM365AuditAttackPaths() {
  const authMethods = useAuthenticationMethods()
  const roles = useEntraRoles()
  const policies = useConditionalAccessPolicies()
  const crossTenant = useCrossTenantAccess()
  const riskyUsers = useRiskyUsers()
  const servicePrincipals = useServicePrincipals()
  const groups = useEntraGroups()

  const loading =
    authMethods.loading || roles.loading || policies.loading ||
    crossTenant.loading || riskyUsers.loading || servicePrincipals.loading || groups.loading

  const error =
    authMethods.error || roles.error || policies.error ||
    crossTenant.error || riskyUsers.error || servicePrincipals.error || groups.error || null

  const result = useMemo<AttackPathResult | null>(() => {
    if (loading) return null
    return buildM365AttackPaths(
      authMethods.users,
      groups.groups,
      roles.roles,
      servicePrincipals.servicePrincipals,
      policies.policies,
      crossTenant.partners,
      riskyUsers.riskyUsers,
    )
  }, [loading, authMethods.users, groups.groups, roles.roles, servicePrincipals.servicePrincipals, policies.policies, crossTenant.partners, riskyUsers.riskyUsers])

  return {
    nodes: result?.nodes ?? [],
    edges: result?.edges ?? [],
    highlightedPaths: result?.highlightedPaths ?? [],
    loading,
    error,
  }
}
