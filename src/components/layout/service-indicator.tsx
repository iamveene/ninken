"use client"

import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import "@/lib/providers"

export function ServiceIndicator() {
  const { provider, loading } = useProvider()
  const providerConfig = getProvider(provider)

  if (loading || !providerConfig) return null

  const Icon = resolveIcon(providerConfig.iconName)

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" />
      {providerConfig.name}
    </span>
  )
}
