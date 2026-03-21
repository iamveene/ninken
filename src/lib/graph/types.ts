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
}

export type ProfileScopeInfo = {
  profileId: string
  provider: ProviderId
  scopes: string[]
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
