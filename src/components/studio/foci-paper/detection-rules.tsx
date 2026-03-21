"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Copy, ShieldAlert } from "lucide-react"

interface DetectionRule {
  id: string
  name: string
  severity: "High" | "Medium" | "Low"
  description: string
  yaml: string
}

const DETECTION_RULES: DetectionRule[] = [
  {
    id: "spa-scope-expansion",
    name: "SPA Token Resource Scope Expansion",
    severity: "High",
    description: "Triggers when an OWA or Teams Web token accesses resources outside its expected scope (Graph, Exchange Online).",
    yaml: `# Sentinel Analytics Rule: SPA Token Scope Expansion
name: "SPA Token Resource Scope Expansion"
description: "Detects when SPA-bound web app tokens access unexpected resources"
severity: High
tactics:
  - CredentialAccess
  - LateralMovement
query: |
  SigninLogs
  | where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
  | where ResourceDisplayName !in ("Microsoft Graph", "Office 365 Exchange Online")
  | where ResultType == 0
  | project TimeGenerated, UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress, Location
triggerOperator: GreaterThan
triggerThreshold: 0
frequency: PT5M
period: PT1H`,
  },
  {
    id: "spa-multi-ip",
    name: "SPA Token Multi-IP Usage",
    severity: "High",
    description: "Detects when the same user's SPA token is used from multiple IP addresses within one hour, indicating potential token extraction.",
    yaml: `# Sentinel Analytics Rule: SPA Token Multi-IP
name: "SPA Token Multi-IP Usage"
description: "Detects SPA token usage from multiple IPs indicating extraction"
severity: High
tactics:
  - CredentialAccess
  - InitialAccess
query: |
  SigninLogs
  | where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
  | where ResultType == 0
  | summarize DistinctIPs=dcount(IPAddress), IPs=make_set(IPAddress) by UserPrincipalName, AppDisplayName, bin(TimeGenerated, 1h)
  | where DistinctIPs > 1
triggerOperator: GreaterThan
triggerThreshold: 0
frequency: PT15M
period: PT1H`,
  },
  {
    id: "bulk-graph-enum",
    name: "Bulk Graph API Enumeration via SPA Token",
    severity: "Medium",
    description: "Detects high-volume Graph API calls from web clients, indicating directory enumeration or data harvesting.",
    yaml: `# Sentinel Analytics Rule: Bulk Graph Enumeration
name: "Bulk Graph API Enumeration via SPA Token"
description: "Detects high-volume directory queries from web app tokens"
severity: Medium
tactics:
  - Discovery
  - Collection
query: |
  AuditLogs
  | where InitiatedBy.app.displayName in ("One Outlook Web", "Microsoft Teams Web Client")
  | where OperationName in ("List users", "List groups", "List members")
  | summarize OpCount=count() by InitiatedBy.user.userPrincipalName, bin(TimeGenerated, 5m)
  | where OpCount > 50
triggerOperator: GreaterThan
triggerThreshold: 0
frequency: PT5M
period: PT30M`,
  },
  {
    id: "spa-origin-mismatch",
    name: "SPA Origin Binding Failure",
    severity: "Medium",
    description: "Monitors for AADSTS9002313 errors which indicate SPA refresh token replay from a non-matching origin.",
    yaml: `# Sentinel Analytics Rule: SPA Origin Mismatch
name: "SPA Origin Binding Failure"
description: "Monitors for SPA origin binding errors indicating token replay attempts"
severity: Medium
tactics:
  - CredentialAccess
query: |
  SigninLogs
  | where ResultType == 9002313
  | where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
  | project TimeGenerated, UserPrincipalName, AppDisplayName, IPAddress, ResultDescription
triggerOperator: GreaterThan
triggerThreshold: 0
frequency: PT5M
period: PT1H`,
  },
]

const SEVERITY_COLORS: Record<string, string> = {
  High: "bg-red-500/15 text-red-400 border-red-500/30",
  Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Low: "bg-sky-500/15 text-sky-400 border-sky-500/30",
}

export function DetectionRules() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sentinel Detection Rules
        </h3>
        <Badge variant="outline" className="text-[9px]">{DETECTION_RULES.length}</Badge>
      </div>

      <div className="space-y-2">
        {DETECTION_RULES.map((rule) => (
          <DetectionRuleCard key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  )
}

function DetectionRuleCard({ rule }: { rule: DetectionRule }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rule.yaml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {rule.name}
            <Badge className={`text-[9px] uppercase ${SEVERITY_COLORS[rule.severity]}`}>
              {rule.severity}
            </Badge>
          </CardTitle>
        </div>
        <CardDescription className="text-xs">{rule.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded border border-border/50 bg-black/40 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy YAML</span>
              </>
            )}
          </button>
          <pre className="overflow-x-auto rounded border border-border/30 bg-black/30 p-3 text-[11px] font-mono text-muted-foreground leading-relaxed">
            {rule.yaml}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
