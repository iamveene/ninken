"use client"

import Link from "next/link"
import { useScopes } from "@/hooks/use-scopes"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton"
import "@/lib/providers"
import type { SlackCredential } from "@/lib/providers/types"

function ScopeStatusBadge({ accessible }: { accessible: boolean }) {
  return accessible ? (
    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Accessible
    </Badge>
  ) : (
    <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 text-[10px]">
      <XCircle className="h-3 w-3 mr-1" />
      No Access
    </Badge>
  )
}

export default function SlackDashboardPage() {
  const { hasApp, scopes, loading: scopesLoading } = useScopes()
  const { profile, loading: providerLoading } = useProvider()
  const providerConfig = getProvider("slack")

  const operateNavItems = providerConfig?.operateNavItems ?? []
  const scopeAppMap = providerConfig?.scopeAppMap ?? {}

  const accessibleCount = operateNavItems.filter((item) => hasApp(item.id)).length
  const totalServices = operateNavItems.length

  // Derive token type label and OpSec level from credential
  const credential = profile?.credential as SlackCredential | undefined
  const isApiToken = credential?.credentialKind === "api-token"
  const tokenTypeLabel = isApiToken
    ? credential.token_type === "bot"
      ? "Bot Token (xoxb-)"
      : "User Token (xoxp-)"
    : "Browser Session"
  const tokenTypeShort = isApiToken
    ? credential.token_type === "bot" ? "Bot" : "User"
    : "Session"
  const isHighOpsec = isApiToken

  if (providerLoading) return <DashboardSkeleton statCards={3} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Slack Workspace</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {profile?.email ?? "Unknown user"} — {tokenTypeLabel}
            </p>
            {isHighOpsec ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                <ShieldCheck className="h-3 w-3 mr-1" />
                High OpSec
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 text-[10px]">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Low OpSec
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <p className="text-[10px] text-muted-foreground">Capabilities</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LayoutDashboard className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{tokenTypeShort}</p>
              <p className="text-[10px] text-muted-foreground">Token Type</p>
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
            const accessible = hasApp(item.id)
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
                      {matchedScopes.length}/{itemScopes.length} capabilities granted
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Capabilities</h2>
        <Card>
          <CardContent className="p-4">
            {scopesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
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
              <p className="text-xs text-muted-foreground">No capabilities available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
