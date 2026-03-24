"use client"

import { useMemo } from "react"
import { useAuthenticationMethods, useRiskyUsers, useRiskDetections, useCrossTenantAccess, useConditionalAccessPolicies, useServicePrincipals } from "@/hooks/use-m365-audit"
import { useEntraGroups, useEntraRoles } from "@/hooks/use-entra"
import { computeM365RiskAssessment, type M365RiskAssessment } from "@/lib/audit/m365-risk-scoring"

export function useM365AuditRisk(enabled = true) {
  const authMethods = useAuthenticationMethods()
  const roles = useEntraRoles()
  const policies = useConditionalAccessPolicies()
  const crossTenant = useCrossTenantAccess()
  const riskyUsers = useRiskyUsers()
  const riskDetections = useRiskDetections()
  const servicePrincipals = useServicePrincipals()
  const groups = useEntraGroups()

  const loading = !enabled ? false :
    authMethods.loading || roles.loading || policies.loading ||
    crossTenant.loading || riskyUsers.loading || riskDetections.loading ||
    servicePrincipals.loading || groups.loading

  const error = !enabled ? null :
    authMethods.error || roles.error || policies.error ||
    crossTenant.error || riskyUsers.error || riskDetections.error ||
    servicePrincipals.error || groups.error || null

  const assessment = useMemo<M365RiskAssessment | null>(() => {
    if (!enabled || loading) return null
    return computeM365RiskAssessment(
      authMethods.users,
      roles.roles,
      policies.policies,
      crossTenant.partners,
      crossTenant.defaultPolicy,
      groups.groups,
      riskyUsers.riskyUsers,
      riskDetections.riskDetections,
      servicePrincipals.servicePrincipals,
    )
  }, [enabled, loading, authMethods.users, roles.roles, policies.policies, crossTenant.partners, crossTenant.defaultPolicy, groups.groups, riskyUsers.riskyUsers, riskDetections.riskDetections, servicePrincipals.servicePrincipals])

  const partialData =
    authMethods.users.length > 0 || roles.roles.length > 0 || policies.policies.length > 0

  return { assessment, loading: enabled && loading, error, partialData }
}
