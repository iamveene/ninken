"use client"

import { useScopes } from "@/hooks/use-scopes"
import { useGitLabUser } from "@/hooks/use-gitlab"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ServiceError } from "@/components/ui/service-error"
import Link from "next/link"
import {
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  Gitlab,
} from "lucide-react"
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

export default function GitLabDashboardPage() {
  const { hasApp, scopes, loading: scopesLoading } = useScopes()
  const { user, loading: userLoading, error: userError } = useGitLabUser()
  const { profile } = useProvider()
  const providerConfig = getProvider("gitlab")

  const operateNavItems = providerConfig?.operateNavItems ?? []
  const scopeAppMap = providerConfig?.scopeAppMap ?? {}

  const accessibleCount = operateNavItems.filter((item) => hasApp(item.id)).length
  const totalServices = operateNavItems.length

  const rateLimitRemaining = user?.rateLimit?.remaining ?? 0
  const rateLimitReset = user?.rateLimit?.reset
    ? new Date(user.rateLimit.reset * 1000).toLocaleTimeString()
    : "N/A"

  if (userError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">GitLab</h1>
        <ServiceError error={userError} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Gitlab className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">GitLab</h1>
          <p className="text-xs text-muted-foreground">
            {user?.username ?? profile?.email ?? "Unknown user"}
            {user?.tokenName ? ` — ${user.tokenName}` : ""}
          </p>
        </div>
      </div>

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
              <p className="text-[10px] text-muted-foreground">PAT Scopes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{rateLimitRemaining}</p>
              <p className="text-[10px] text-muted-foreground">Rate Limit Left</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-sm">{rateLimitReset}</p>
              <p className="text-[10px] text-muted-foreground">Rate Reset</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Info */}
      {!userLoading && user && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Username</p>
                <p className="text-xs font-medium">{user.username}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Name</p>
                <p className="text-xs font-medium">{user.name || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Admin</p>
                <p className="text-xs font-medium">{user.isAdmin ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">2FA</p>
                <p className="text-xs font-medium">
                  {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              {user.tokenExpiresAt && (
                <div>
                  <p className="text-[10px] text-muted-foreground">Token Expires</p>
                  <p className="text-xs font-medium">
                    {new Date(user.tokenExpiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                      {matchedScopes.length}/{itemScopes.length} scopes granted
                    </p>
                    {!scopesLoading && accessible && matchedScopes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {matchedScopes.slice(0, 2).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                            {s}
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
              <p className="text-xs text-muted-foreground">
                No scopes detected (token may lack read_api scope to introspect)
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
