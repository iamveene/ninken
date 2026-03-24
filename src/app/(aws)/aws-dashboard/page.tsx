"use client"

import Link from "next/link"
import { useScopes } from "@/hooks/use-scopes"
import { useAwsIdentity } from "@/hooks/use-aws"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ServiceError } from "@/components/ui/service-error"
import {
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Cloud,
  ShieldCheck,
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
      No Access
    </Badge>
  )
}

export default function AwsDashboardPage() {
  const { hasApp, loading: scopesLoading } = useScopes()
  const { identity, loading: identityLoading, error: identityError } = useAwsIdentity()
  const { profile, loading: providerLoading } = useProvider()
  const providerConfig = getProvider("aws")

  const operateNavItems = providerConfig?.operateNavItems ?? []

  const accessibleCount = operateNavItems.filter((item) => hasApp(item.id)).length
  const totalServices = operateNavItems.length

  if (providerLoading) return <DashboardSkeleton />

  if (identityError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">AWS</h1>
        <ServiceError error={identityError} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Cloud className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AWS</h1>
          <p className="text-xs text-muted-foreground">
            {identity?.arn ?? profile?.email ?? "Unknown identity"}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <ShieldCheck className="h-3 w-3 mr-1" />
          High OpSec
        </Badge>
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
              <p className="text-2xl font-bold truncate text-sm">{identity?.accountId ?? "-"}</p>
              <p className="text-[10px] text-muted-foreground">Account ID</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Cloud className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-sm">{identity?.region ?? "-"}</p>
              <p className="text-[10px] text-muted-foreground">Region</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-sm">{identity?.userId ?? "-"}</p>
              <p className="text-[10px] text-muted-foreground">User ID</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Identity Info */}
      {!identityLoading && identity && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-muted-foreground">ARN</p>
                <p className="text-xs font-medium font-mono break-all">{identity.arn}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Account ID</p>
                <p className="text-xs font-medium font-mono">{identity.accountId}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Default Region</p>
                <p className="text-xs font-medium">{identity.region}</p>
              </div>
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
                      {accessible ? "Click to explore" : "Access not detected"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Identity Detail */}
      {!scopesLoading && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Credential Info</h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] font-mono">
                  IAM Access Key
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                  API-based (no browser traces)
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                  High OpSec
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
