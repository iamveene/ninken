import type { Node, Edge } from "@xyflow/react"
import type { ProfileScopeInfo, OperatorNodeData, AccountNodeData, ServiceNodeData } from "./types"
import type { StoredProfile } from "@/lib/providers/types"
import { getProfileProviders } from "@/lib/providers/types"

type BuildInput = {
  profiles: StoredProfile[]
  scopeData: ProfileScopeInfo[]
}

export function buildGraphLayout({ profiles, scopeData }: BuildInput): {
  nodes: Node[]
  edges: Edge[]
} {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Operator node at center
  nodes.push({
    id: "operator",
    type: "operator",
    position: { x: 0, y: 0 },
    data: { label: "Operator" } satisfies OperatorNodeData,
    draggable: true,
  })

  // Group scope data by profile
  const scopeByProfile = new Map<string, ProfileScopeInfo[]>()
  for (const info of scopeData) {
    const arr = scopeByProfile.get(info.profileId) ?? []
    arr.push(info)
    scopeByProfile.set(info.profileId, arr)
  }

  // Place account nodes in a ring around operator
  const accountRadius = 350
  const accountCount = profiles.length
  const accountAngleStep = (2 * Math.PI) / Math.max(accountCount, 1)

  profiles.forEach((profile, idx) => {
    const providers = getProfileProviders(profile)
    const angle = accountAngleStep * idx - Math.PI / 2
    const ax = Math.cos(angle) * accountRadius
    const ay = Math.sin(angle) * accountRadius

    const accountId = `account-${profile.id}`
    const accountData: AccountNodeData = {
      profileId: profile.id,
      email: profile.email ?? profile.label ?? "Unknown",
      provider: profile.activeProvider ?? profile.provider,
      providers,
      label: profile.email ?? profile.label ?? profile.provider,
    }

    nodes.push({
      id: accountId,
      type: "account",
      position: { x: ax, y: ay },
      data: accountData,
      draggable: true,
    })

    edges.push({
      id: `operator-${accountId}`,
      source: "operator",
      target: accountId,
      type: "glowing",
      data: { variant: "operator" },
    })

    // Place service nodes for each provider linked to this profile
    const profileScopes = scopeByProfile.get(profile.id) ?? []

    // Collect all services across all providers for this profile
    const allServices: (ProfileScopeInfo["services"][number] & { provider: string })[] = []
    for (const ps of profileScopes) {
      for (const svc of ps.services) {
        allServices.push({ ...svc, provider: ps.provider })
      }
    }

    const serviceCount = allServices.length
    if (serviceCount === 0) return

    // Fan services outward from account node
    const serviceRadius = 220
    const maxArc = Math.PI * 0.8
    const arcStep = serviceCount > 1 ? maxArc / (serviceCount - 1) : 0
    const startAngle = angle - maxArc / 2

    allServices.forEach((svc, sIdx) => {
      const sAngle = serviceCount > 1 ? startAngle + arcStep * sIdx : angle
      const sx = ax + Math.cos(sAngle) * serviceRadius
      const sy = ay + Math.sin(sAngle) * serviceRadius

      const serviceNodeId = `service-${profile.id}-${svc.provider}-${svc.serviceId}`
      const serviceData: ServiceNodeData = {
        serviceId: svc.serviceId,
        serviceName: svc.serviceName,
        iconName: svc.iconName,
        href: svc.href,
        provider: svc.provider as any,
        profileId: profile.id,
        active: svc.active,
        scopeCount: svc.scopeCount,
        grantedScopes: svc.grantedScopes,
        allScopes: svc.allScopes,
      }

      nodes.push({
        id: serviceNodeId,
        type: "service",
        position: { x: sx, y: sy },
        data: serviceData,
        draggable: true,
      })

      edges.push({
        id: `${accountId}-${serviceNodeId}`,
        source: accountId,
        target: serviceNodeId,
        type: "glowing",
        data: { variant: svc.active ? "service" : "inactive" },
      })
    })
  })

  return { nodes, edges }
}
