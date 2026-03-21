"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useScopes } from "@/hooks/use-scopes"
import { useGcpKeyInfo } from "@/hooks/use-gcp-key"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ServiceError } from "@/components/ui/service-error"
import {
  Flame,
  Key,
  CheckCircle2,
  XCircle,
  Shield,
  ShieldAlert,
  FolderOpen,
} from "lucide-react"
import "@/lib/providers"

const PROJECT_ID_KEY = "ninken:gcp:projectId"

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

export default function GcpDashboardPage() {
  const { hasApp, loading: scopesLoading } = useScopes()
  const { info, loading: infoLoading, error: infoError } = useGcpKeyInfo()
  const { profile } = useProvider()
  const providerConfig = getProvider("gcp")

  const operateNavItems = providerConfig?.operateNavItems ?? []

  const [projectId, setProjectId] = useState("")

  // Initialize project ID from info or sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(PROJECT_ID_KEY)
    if (stored) {
      setProjectId(stored)
    } else if (info?.projectId) {
      setProjectId(info.projectId)
      sessionStorage.setItem(PROJECT_ID_KEY, info.projectId)
    }
  }, [info?.projectId])

  const handleProjectIdChange = (value: string) => {
    setProjectId(value)
    if (value) {
      sessionStorage.setItem(PROJECT_ID_KEY, value)
    } else {
      sessionStorage.removeItem(PROJECT_ID_KEY)
    }
  }

  const accessibleCount = operateNavItems.filter((item) => hasApp(item.id)).length
  const totalServices = operateNavItems.length

  if (infoError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">GCP</h1>
        <ServiceError error={infoError} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Flame className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">GCP Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {info?.keyPrefix ? `API Key: ${info.keyPrefix}` : profile?.email ?? "Unknown identity"}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto border-amber-500/30 bg-amber-500/10 text-amber-400">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Medium OpSec
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{accessibleCount}/{totalServices}</p>
              <p className="text-[10px] text-muted-foreground">APIs Accessible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Key className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-bold truncate font-mono">{info?.keyPrefix || "-"}</p>
              <p className="text-[10px] text-muted-foreground">API Key</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-bold truncate">{projectId || "-"}</p>
              <p className="text-[10px] text-muted-foreground">Project ID</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Flame className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{info?.enabledApis?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Enabled APIs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project ID Input */}
      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-sm">Project Configuration</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Project ID</label>
            <Input
              value={projectId}
              onChange={(e) => handleProjectIdChange(e.target.value)}
              placeholder="Enter GCP project ID (e.g., my-project-123)"
              className="h-8 text-xs font-mono"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Required for most GCP APIs. API keys are project-scoped but don&apos;t self-identify their project.
          </p>
        </CardContent>
      </Card>

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
                      {accessible ? "Click to explore" : "API not enabled or key restricted"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Credential Info */}
      {!scopesLoading && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Credential Info</h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] font-mono">
                  Google API Key
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
                  Medium OpSec
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
                  Logged per-project, no user attribution
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
