import type { Node, Edge } from "@xyflow/react"
import type { ProfileScopeInfo, OperatorNodeData, AccountNodeData, ServiceNodeData } from "./types"
import type { StoredProfile } from "@/lib/providers/types"
import { getProfileProviders } from "@/lib/providers/types"

type BuildInput = {
  profiles: StoredProfile[]
  scopeData: ProfileScopeInfo[]
}

// Node size constants for proper spacing
const ACCOUNT_NODE_WIDTH = 200
const ACCOUNT_GAP = 60
const SERVICE_NODE_WIDTH = 140
const SERVICE_GAP = 16
const ROW_GAP_OP_TO_ACCOUNT = 180
const ROW_GAP_ACCOUNT_TO_SERVICE = 150

export function buildGraphLayout({ profiles, scopeData }: BuildInput): {
  nodes: Node[]
  edges: Edge[]
} {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Group scope data by profile
  const scopeByProfile = new Map<string, ProfileScopeInfo[]>()
  for (const info of scopeData) {
    const arr = scopeByProfile.get(info.profileId) ?? []
    arr.push(info)
    scopeByProfile.set(info.profileId, arr)
  }

  // Pre-compute services per account so we know total widths
  type AccountBlock = {
    profile: StoredProfile
    services: (ProfileScopeInfo["services"][number] & { provider: string })[]
    accountWidth: number
    servicesWidth: number
    blockWidth: number
  }

  const blocks: AccountBlock[] = profiles.map((profile) => {
    const profileScopes = scopeByProfile.get(profile.id) ?? []
    const services: AccountBlock["services"] = []
    for (const ps of profileScopes) {
      for (const svc of ps.services) {
        services.push({ ...svc, provider: ps.provider })
      }
    }

    const servicesWidth = services.length > 0
      ? services.length * SERVICE_NODE_WIDTH + (services.length - 1) * SERVICE_GAP
      : 0

    // Block width = max of account node width and services spread
    const blockWidth = Math.max(ACCOUNT_NODE_WIDTH, servicesWidth)

    return { profile, services, accountWidth: ACCOUNT_NODE_WIDTH, servicesWidth, blockWidth }
  })

  // Total width of all blocks with gaps
  const totalWidth = blocks.reduce((sum, b) => sum + b.blockWidth, 0)
    + (blocks.length - 1) * ACCOUNT_GAP

  // Operator node centered at top
  const operatorX = 0
  const operatorY = 0

  nodes.push({
    id: "operator",
    type: "operator",
    position: { x: operatorX - 36, y: operatorY }, // center the 72px node
    data: { label: "Operator" } satisfies OperatorNodeData,
    draggable: true,
  })

  // Account row starts below operator, centered
  const accountY = operatorY + ROW_GAP_OP_TO_ACCOUNT
  let cursorX = -(totalWidth / 2)

  blocks.forEach((block) => {
    const { profile, services, blockWidth, servicesWidth } = block
    const providers = getProfileProviders(profile)
    const accountId = `account-${profile.id}`

    // Center account node within its block
    const accountX = cursorX + (blockWidth - ACCOUNT_NODE_WIDTH) / 2

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
      position: { x: accountX, y: accountY },
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

    // Service row below account, centered within the block
    if (services.length > 0) {
      const serviceY = accountY + ROW_GAP_ACCOUNT_TO_SERVICE
      const servicesStartX = cursorX + (blockWidth - servicesWidth) / 2

      services.forEach((svc, sIdx) => {
        const serviceX = servicesStartX + sIdx * (SERVICE_NODE_WIDTH + SERVICE_GAP)
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
          position: { x: serviceX, y: serviceY },
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
    }

    cursorX += blockWidth + ACCOUNT_GAP
  })

  return { nodes, edges }
}
