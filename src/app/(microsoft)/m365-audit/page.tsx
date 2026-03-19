"use client"

import Link from "next/link"
import {
  Mail,
  HardDrive,
  Users,
  ShieldCheck,
  ArrowRight,
  AppWindow,
  UsersRound,
  Scan,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useM365AuditOverview } from "@/hooks/use-m365-audit"
import type { LucideIcon } from "lucide-react"

const quickLinks = [
  { label: "Users", href: "/m365-audit/users", icon: Users },
  { label: "Groups", href: "/m365-audit/groups", icon: UsersRound },
  { label: "Roles", href: "/m365-audit/roles", icon: ShieldCheck },
  { label: "Apps", href: "/m365-audit/apps", icon: AppWindow },
]

function ServiceCard({
  name,
  icon: Icon,
  accessible,
  loading,
  children,
}: {
  name: string
  icon: LucideIcon
  accessible: boolean
  loading: boolean
  children?: React.ReactNode
}) {
  return (
    <Card className={accessible ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500 opacity-60"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {name}
          {!loading && (
            accessible
              ? <Badge variant="secondary" className="ml-auto text-emerald-400 bg-emerald-500/10 text-[10px]">Accessible</Badge>
              : <Badge variant="secondary" className="ml-auto text-red-400 bg-red-500/10 text-[10px]">No Access</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export default function M365AuditDashboardPage() {
  const { overview, loading, error } = useM365AuditOverview()

  const scopes = overview?.tokenInfo.scopes ?? []
  const expiresIn = overview?.tokenInfo.expiresIn

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold">M365 Audit Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What this token can access across Microsoft 365 — from the current user&apos;s perspective.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Token Info */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Token Status</h2>
        <Card>
          <CardContent className="py-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Scan className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{overview?.tokenInfo.email || "Unknown"}</span>
                  </div>
                  {overview?.tokenInfo.tenantId && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Tenant: {overview.tokenInfo.tenantId.slice(0, 8)}...
                    </Badge>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {expiresIn != null ? `Access token expires in ${Math.floor(expiresIn / 60)}m ${expiresIn % 60}s` : "Unknown expiry"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{scopes.length} scopes</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-[10px] font-mono">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Access Grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Service Access</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCard name="Outlook" icon={Mail} accessible={overview?.outlook.accessible ?? false} loading={loading}>
            <p>{overview?.outlook.accessible ? "Mail access available" : "No mail access"}</p>
          </ServiceCard>

          <ServiceCard name="OneDrive" icon={HardDrive} accessible={overview?.onedrive.accessible ?? false} loading={loading}>
            <p>{overview?.onedrive.accessible ? "Drive access available" : "No drive access"}</p>
          </ServiceCard>

          <ServiceCard name="Teams" icon={MessageSquare} accessible={overview?.teams.accessible ?? false} loading={loading}>
            <p>{overview?.teams.accessible ? "Teams access available" : "No teams access"}</p>
          </ServiceCard>

          <ServiceCard name="Directory (Entra ID)" icon={Users} accessible={overview?.directory.accessible ?? false} loading={loading}>
            {overview?.directory.accessible ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Directory access available</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                <span>No directory access</span>
              </div>
            )}
          </ServiceCard>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Audit Modules</h2>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50 hover:border-border"
            >
              <link.icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{link.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
