"use client"

import {
  CheckCircle2,
  XCircle,
  Key,
  AlertTriangle,
  Server,
  Lock,
  HardDrive,
  GitBranch,
  RefreshCw,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useResourcePivot } from "@/hooks/use-m365-audit"
import type { ResourceProbeEntry } from "@/hooks/use-m365-audit"
import type { LucideIcon } from "lucide-react"

type StatusLevel = "accessible" | "token-only" | "blocked"

function getStatus(entry: ResourceProbeEntry): StatusLevel {
  if (entry.accessible) return "accessible"
  if (entry.tokenObtained) return "token-only"
  return "blocked"
}

function StatusBadge({ status }: { status: StatusLevel }) {
  switch (status) {
    case "accessible":
      return (
        <Badge variant="secondary" className="text-emerald-400 bg-emerald-500/10 text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-0.5" />
          Accessible
        </Badge>
      )
    case "token-only":
      return (
        <Badge variant="secondary" className="text-amber-400 bg-amber-500/10 text-[10px]">
          <Key className="h-3 w-3 mr-0.5" />
          Token Only
        </Badge>
      )
    case "blocked":
      return (
        <Badge variant="secondary" className="text-red-400 bg-red-500/10 text-[10px]">
          <XCircle className="h-3 w-3 mr-0.5" />
          Blocked
        </Badge>
      )
  }
}

function statusBorderClass(status: StatusLevel): string {
  switch (status) {
    case "accessible":
      return "border-l-4 border-l-emerald-500"
    case "token-only":
      return "border-l-4 border-l-amber-500"
    case "blocked":
      return "border-l-4 border-l-red-500 opacity-60"
  }
}

function ResourceCard({
  name,
  description,
  icon: Icon,
  entry,
  loading,
  children,
}: {
  name: string
  description: string
  icon: LucideIcon
  entry: ResourceProbeEntry | undefined
  loading: boolean
  children?: React.ReactNode
}) {
  const status = entry ? getStatus(entry) : "blocked"

  return (
    <Card className={loading ? "" : statusBorderClass(status)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {name}
          {!loading && entry && (
            <span className="ml-auto">
              <StatusBadge status={status} />
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
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

export default function ResourcePivotPage() {
  const { pivot, loading, error, refetch } = useResourcePivot()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Resource Pivot Probing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test if this credential can obtain tokens for non-Graph Azure resources.
            Discovers lateral movement paths beyond Microsoft 365.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Re-probe
        </Button>
      </div>

      {/* OPSEC Warning */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center gap-3 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-200">OPSEC Warning</p>
            <p className="text-xs text-muted-foreground">
              Resource probing generates token acquisition events visible in Azure AD sign-in logs.
              Each probe requests a new token for a distinct resource audience.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 2x2 Resource Grid */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {/* ARM */}
        <ResourceCard
          name="Azure Resource Manager"
          description="management.azure.com"
          icon={Server}
          entry={pivot?.arm}
          loading={loading}
        >
          {pivot?.arm.accessible && pivot.arm.subscriptions ? (
            <div>
              <p className="font-medium text-foreground mb-1">
                {pivot.arm.subscriptions.length} subscription{pivot.arm.subscriptions.length !== 1 ? "s" : ""}
              </p>
              {pivot.arm.subscriptions.length > 0 ? (
                <ul className="space-y-0.5">
                  {pivot.arm.subscriptions.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{sub.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto">
                        {sub.id.slice(0, 8)}...
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs">No subscriptions visible</p>
              )}
            </div>
          ) : pivot?.arm.tokenObtained ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Key className="h-3 w-3 text-amber-400" />
              <span>Token obtained but ARM access denied{pivot.arm.httpStatus ? ` (HTTP ${pivot.arm.httpStatus})` : ""}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="h-3 w-3 text-red-400" />
              <span>Token acquisition failed{pivot?.arm.error ? `: ${pivot.arm.error}` : ""}</span>
            </div>
          )}
        </ResourceCard>

        {/* Key Vault */}
        <ResourceCard
          name="Azure Key Vault"
          description="Key Vault resources via ARM"
          icon={Lock}
          entry={pivot?.keyVault}
          loading={loading}
        >
          {pivot?.keyVault.accessible && pivot.keyVault.vaults ? (
            <div>
              <p className="font-medium text-foreground mb-1">
                {pivot.keyVault.vaults.length} vault{pivot.keyVault.vaults.length !== 1 ? "s" : ""}
              </p>
              {pivot.keyVault.vaults.length > 0 ? (
                <ul className="space-y-0.5">
                  {pivot.keyVault.vaults.map((name) => (
                    <li key={name} className="flex items-center gap-1.5 text-xs">
                      <Lock className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs">No Key Vault resources found in first subscription</p>
              )}
            </div>
          ) : pivot?.keyVault.tokenObtained ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Key className="h-3 w-3 text-amber-400" />
              <span>ARM token available but vault enumeration failed{pivot.keyVault.httpStatus ? ` (HTTP ${pivot.keyVault.httpStatus})` : ""}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="h-3 w-3 text-red-400" />
              <span>{pivot?.keyVault.error || "Requires ARM access with subscriptions"}</span>
            </div>
          )}
        </ResourceCard>

        {/* Azure Storage */}
        <ResourceCard
          name="Azure Storage"
          description="storage.azure.com"
          icon={HardDrive}
          entry={pivot?.storage}
          loading={loading}
        >
          {pivot?.storage.tokenObtained ? (
            <div className="flex items-center gap-1.5 text-xs">
              {pivot.storage.accessible ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>Storage token obtained (no universal list endpoint)</span>
                </>
              ) : (
                <>
                  <Key className="h-3 w-3 text-amber-400" />
                  <span>Token obtained -- storage account access depends on RBAC</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="h-3 w-3 text-red-400" />
              <span>Token acquisition failed{pivot?.storage.error ? `: ${pivot.storage.error}` : ""}</span>
            </div>
          )}
        </ResourceCard>

        {/* Azure DevOps */}
        <ResourceCard
          name="Azure DevOps"
          description="app.vscode.dev"
          icon={GitBranch}
          entry={pivot?.devops}
          loading={loading}
        >
          {pivot?.devops.accessible && pivot.devops.projects ? (
            <div>
              <p className="font-medium text-foreground mb-1">
                {pivot.devops.projects.length} project{pivot.devops.projects.length !== 1 ? "s" : ""}
              </p>
              {pivot.devops.projects.length > 0 ? (
                <ul className="space-y-0.5">
                  {pivot.devops.projects.map((name) => (
                    <li key={name} className="flex items-center gap-1.5 text-xs">
                      <GitBranch className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs">No projects visible</p>
              )}
            </div>
          ) : pivot?.devops.tokenObtained ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Key className="h-3 w-3 text-amber-400" />
              <span>Token obtained but DevOps access denied{pivot.devops.httpStatus ? ` (HTTP ${pivot.devops.httpStatus})` : ""}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="h-3 w-3 text-red-400" />
              <span>Token acquisition failed{pivot?.devops.error ? `: ${pivot.devops.error}` : ""}</span>
            </div>
          )}
        </ResourceCard>
      </div>
    </div>
  )
}
