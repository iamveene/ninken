"use client"

import Link from "next/link"
import { useScopes } from "@/hooks/use-scopes"
import { useTokenInfo } from "@/hooks/use-token-info"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Shield,
  Clock,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
} from "lucide-react"
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton"
import "@/lib/providers"

function ScopeStatusBadge({ accessible }: { accessible: boolean }) {
  return accessible ? (
    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Accessible
    </Badge>
  ) : (
    <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 text-[10px]">
      <XCircle className="h-3 w-3 mr-1" />
      No Scope
    </Badge>
  )
}

export default function M365DashboardPage() {
  const { scopes, loading: scopesLoading } = useScopes()
  const { tokenInfo } = useTokenInfo()
  const { profile, loading: providerLoading, provider } = useProvider()
  const providerConfig = getProvider("microsoft")

  const operateNavItems = providerConfig?.operateNavItems ?? []
  const scopeAppMap = providerConfig?.scopeAppMap ?? {}

  // Use Microsoft's scopeAppMap directly (not useScopes().hasApp which uses the active provider's map)
  const pageHasApp = (appId: string): boolean => {
    if (!scopes) return false
    const required = scopeAppMap[appId]
    if (!required) return false
    return required.some((s) => scopes.includes(s))
  }

  const providerMismatch = provider !== "microsoft"
  const accessibleCount = operateNavItems.filter((item) => pageHasApp(item.id)).length
  const totalServices = operateNavItems.length

  const expiresIn = tokenInfo?.expiresIn ?? 0
  const expiresMinutes = Math.floor(expiresIn / 60)

  if (providerLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Microsoft 365</h1>
          <p className="text-xs text-muted-foreground">
            {profile?.email ?? "Unknown user"} — Service overview and access summary
          </p>
        </div>
      </div>

      {/* Provider mismatch warning */}
      {providerMismatch && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Active session is <span className="font-medium">{provider}</span> — scope data below reflects the active token, not Microsoft 365.
          </span>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{accessibleCount}/{totalServices}</p>
              <p className="text-[10px] text-muted-foreground">Services Accessible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Key className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{scopes?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Delegated Scopes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className={`h-5 w-5 ${expiresMinutes < 10 ? "text-red-500" : "text-amber-500"}`} />
            <div>
              <p className="text-2xl font-bold">{expiresMinutes}m</p>
              <p className="text-[10px] text-muted-foreground">Token Expires</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{totalServices - accessibleCount}</p>
              <p className="text-[10px] text-muted-foreground">Blocked Services</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Services</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {operateNavItems.map((item) => {
            const Icon = resolveIcon(item.iconName)
            const accessible = pageHasApp(item.id)
            const itemScopes = scopeAppMap[item.id] ?? []
            const matchedScopes = scopes?.filter((s) => itemScopes.includes(s)) ?? []

            return (
              <Link key={item.id} href={item.href}>
                <Card className={`transition-all hover:border-primary/30 hover:shadow-md ${accessible ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${accessible ? "text-primary" : "text-muted-foreground"}`} />
                      <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                    </div>
                    <ScopeStatusBadge accessible={accessible} />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-[10px] text-muted-foreground">
                      {matchedScopes.length}/{itemScopes.length} scopes granted
                    </p>
                    {!scopesLoading && accessible && matchedScopes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {matchedScopes.slice(0, 2).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                            {s.split(".").slice(0, 2).join(".")}
                          </Badge>
                        ))}
                        {matchedScopes.length > 2 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            +{matchedScopes.length - 2} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Scopes Detail */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Granted Scopes</h2>
        <Card>
          <CardContent className="p-4">
            {scopesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : scopes && scopes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {scopes.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-mono">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No scopes available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
