import type { ProviderId, StoredProfile } from "@/lib/providers/types"

export type OperatorNodeData = {
  label: string
}

export type AccountNodeData = {
  profileId: string
  email: string
  provider: ProviderId
  providers: ProviderId[]
  label: string
}

export type ServiceStat = {
  label: string
  value: number | string | null
}

export type ServiceNodeData = {
  serviceId: string
  serviceName: string
  iconName: string
  href: string
  provider: ProviderId
  profileId: string
  active: boolean
  scopeCount: number
  grantedScopes: string[]
  allScopes: string[]
  stat: ServiceStat | null
}

export type ProfileScopeInfo = {
  profileId: string
  provider: ProviderId
  scopes: string[]
  stats: Record<string, ServiceStat>
  services: {
    serviceId: string
    serviceName: string
    iconName: string
    href: string
    active: boolean
    scopeCount: number
    grantedScopes: string[]
    allScopes: string[]
  }[]
}
