"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StealthBadge } from "@/components/studio/stealth-badge"
import { findServicesByScope, GOOGLE_SERVICES } from "@/lib/studio/google-services"
import { findMicrosoftServicesByScope, MICROSOFT_SERVICES } from "@/lib/studio/microsoft-services"
import type { Platform } from "@/lib/studio/token-types"
import { Layers } from "lucide-react"

interface CapabilitiesPanelProps {
  scopes: string[]
  platform: Platform
}

export function CapabilitiesPanel({ scopes, platform }: CapabilitiesPanelProps) {
  if (scopes.length === 0) return null

  // Find which services are unlocked by these scopes
  const unlockedServices = new Map<string, { name: string; matchedScopes: string[] }>()

  for (const scope of scopes) {
    if (platform === "google" || platform === "unknown") {
      const services = findServicesByScope(scope)
      for (const svc of services) {
        const existing = unlockedServices.get(svc.id)
        if (existing) {
          existing.matchedScopes.push(scope)
        } else {
          unlockedServices.set(svc.id, { name: svc.name, matchedScopes: [scope] })
        }
      }
    }

    if (platform === "microsoft" || platform === "unknown") {
      const services = findMicrosoftServicesByScope(scope)
      for (const svc of services) {
        const existing = unlockedServices.get(svc.id)
        if (existing) {
          existing.matchedScopes.push(scope)
        } else {
          unlockedServices.set(svc.id, { name: svc.name, matchedScopes: [scope] })
        }
      }
    }
  }

  if (unlockedServices.size === 0) return null

  // Get full service info for stealth levels
  const allServices = [...GOOGLE_SERVICES, ...MICROSOFT_SERVICES]

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Unlocked Services ({unlockedServices.size})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from(unlockedServices.entries()).map(([id, { name, matchedScopes }]) => {
            const fullService = allServices.find((s) => s.id === id)
            return (
              <div
                key={id}
                className="flex items-start gap-2 rounded border border-border/30 bg-black/10 px-2 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{name}</span>
                    {fullService && (
                      <StealthBadge level={fullService.stealthLevel} showLabel={false} size="sm" />
                    )}
                    {fullService?.commonlyMonitored && (
                      <Badge variant="destructive" className="text-[8px]">Monitored</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {matchedScopes.map((s) => (
                      <span key={s} className="text-[9px] font-mono text-muted-foreground">
                        {s.replace("https://www.googleapis.com/auth/", "")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
