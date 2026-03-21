"use client"

import { useRouter } from "next/navigation"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import "@/lib/providers"

export function ServiceIndicator() {
  const router = useRouter()
  const { provider, profiles, profile: activeProfile, switchProfile, loading } = useProvider()
  const providerConfig = getProvider(provider)

  if (loading || !providerConfig) return null

  const Icon = resolveIcon(providerConfig.iconName)

  // Get unique providers from stored profiles
  const providerProfiles = profiles.map((p) => ({
    profile: p,
    config: getProvider(p.provider),
  })).filter((x) => x.config)

  // If only one provider, just show the label (no dropdown)
  const uniqueProviders = new Set(profiles.map((p) => p.provider))
  if (uniqueProviders.size <= 1) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {providerConfig.name}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="outline-none"
        render={
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer"
          />
        }
      >
        <Icon className="h-3 w-3" />
        {providerConfig.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch Service</DropdownMenuLabel>
          {providerProfiles.map(({ profile: p, config }) => {
            const PIcon = resolveIcon(config!.iconName)
            const isActive = p.id === activeProfile?.id
            return (
              <DropdownMenuItem
                key={p.id}
                className="gap-2"
                onClick={async () => {
                  if (!isActive) {
                    await switchProfile(p.id)
                    router.push(config!.defaultRoute)
                  }
                }}
              >
                <PIcon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                <span className={`flex-1 text-xs ${isActive ? "text-emerald-500 font-medium" : ""}`}>{config!.name}</span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {p.email?.split("@")[0]}
                </span>
                {isActive && <Check className="h-3 w-3 text-emerald-500" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
