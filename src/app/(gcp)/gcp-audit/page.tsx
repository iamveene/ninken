"use client"

import Link from "next/link"
import { useGcpAuditBuckets, useGcpAuditFirewall, useGcpAuditApiKeys } from "@/hooks/use-gcp-audit"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Globe,
  Shield,
  Key,
  ShieldAlert,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react"

const auditCards = [
  {
    id: "public-buckets",
    title: "Public Buckets",
    description: "Cloud Storage buckets with public IAM bindings",
    href: "/gcp-audit/public-buckets",
    icon: Globe,
    color: "text-amber-400",
  },
  {
    id: "firewall",
    title: "Firewall Rules",
    description: "VPC firewall rules open to the internet",
    href: "/gcp-audit/firewall",
    icon: Shield,
    color: "text-blue-400",
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "API key restriction and security analysis",
    href: "/gcp-audit/api-keys",
    icon: Key,
    color: "text-emerald-400",
  },
  {
    id: "risk-dashboard",
    title: "Risk Dashboard",
    description: "Aggregated risk heatmap across all categories",
    href: "/gcp-audit/risk-dashboard",
    icon: ShieldAlert,
    color: "text-red-400",
  },
]

export default function GcpAuditDashboardPage() {
  const { results: bucketResults } = useGcpAuditBuckets()
  const { rules: firewallRules } = useGcpAuditFirewall()
  const { keys: apiKeys, unavailable: apiKeysUnavailable } = useGcpAuditApiKeys()

  const publicBucketCount = bucketResults.filter((b) => b.isPublic).length
  const openFirewallCount = firewallRules.filter((r) => r.isOpenToWorld).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">GCP Audit Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Security posture analysis for GCP project
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{bucketResults.length}</p>
            <p className="text-[10px] text-muted-foreground">Buckets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${publicBucketCount > 0 ? "text-red-400" : ""}`}>
              {publicBucketCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Public Buckets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{firewallRules.length}</p>
            <p className="text-[10px] text-muted-foreground">Firewall Rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${openFirewallCount > 0 ? "text-amber-400" : ""}`}>
              {openFirewallCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Open to World</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {auditCards.map((card) => {
          const Icon = card.icon
          let stat: string | null = null
          if (card.id === "public-buckets") stat = `${publicBucketCount} found`
          else if (card.id === "firewall") stat = `${openFirewallCount} open`
          else if (card.id === "api-keys") stat = apiKeysUnavailable ? "restricted" : `${apiKeys.length} keys`

          return (
            <Link key={card.id} href={card.href}>
              <Card className="transition-all hover:border-primary/30 hover:shadow-md cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${card.color}`} />
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {stat && (
                      <span className="text-[10px] text-muted-foreground">{stat}</span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-[10px] text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
