"use client"

import { useMemo } from "react"
import {
  useAuditUsers,
  useAuditGroups,
  useAuditRoles,
  useAuditDelegation,
  useAuditApps,
  useAuditOverview,
} from "@/hooks/use-audit"
import { computeRiskAssessment, type RiskAssessment } from "@/lib/audit/risk-scoring"

export function useAuditRisk(enabled = true) {
  const users = useAuditUsers()
  const groups = useAuditGroups()
  const roles = useAuditRoles()
  const delegation = useAuditDelegation()
  const apps = useAuditApps()
  const { overview } = useAuditOverview()

  const loading =
    !enabled ? false :
    users.loading || groups.loading || roles.loading || delegation.loading || apps.loading

  const error =
    !enabled ? null :
    users.error || groups.error || roles.error || delegation.error || apps.error || null

  const assessment = useMemo<RiskAssessment | null>(() => {
    if (!enabled || loading) return null

    return computeRiskAssessment(
      users.data.users,
      roles.data.roles,
      delegation.delegations,
      groups.data.groups,
      apps.apps,
      overview ?? null,
    )
  }, [
    enabled,
    loading,
    users.data.users,
    roles.data.roles,
    delegation.delegations,
    groups.data.groups,
    apps.apps,
    overview,
  ])

  // Partial data: at least some data loaded even if some errored
  const partialData =
    users.data.users.length > 0 ||
    groups.data.groups.length > 0 ||
    roles.data.roles.length > 0

  return {
    assessment,
    loading: enabled && loading,
    error,
    partialData,
  }
}
