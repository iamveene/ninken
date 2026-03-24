"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Copy, Database } from "lucide-react"

interface KqlQuery {
  id: string
  title: string
  description: string
  severity: "high" | "medium" | "low"
  query: string
}

const KQL_QUERIES: KqlQuery[] = [
  {
    id: "spa-unusual-ip",
    title: "SPA Token Usage from Unusual IPs",
    description: "Detect when SPA-bound tokens are used from IP addresses outside the known corporate range.",
    severity: "high",
    query: `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where IPAddress !in (known_corporate_ips)
| project TimeGenerated, UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress, Location`,
  },
  {
    id: "resource-scope-expansion",
    title: "Resource Scope Expansion",
    description: "Detect when an OWA token is used to access resources beyond Graph and Exchange Online, indicating scope expansion.",
    severity: "high",
    query: `SigninLogs
| where AppDisplayName == "One Outlook Web"
| where ResourceDisplayName != "Microsoft Graph" and ResourceDisplayName != "Office 365 Exchange Online"
| project TimeGenerated, UserPrincipalName, ResourceDisplayName`,
  },
  {
    id: "spa-refresh-replay",
    title: "SPA Refresh Token Replay",
    description: "Detect refresh token usage from multiple IP addresses within a short window, indicating token extraction and replay.",
    severity: "high",
    query: `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where ResultType == 0
| summarize RefreshCount=count(), DistinctIPs=dcount(IPAddress) by UserPrincipalName, AppDisplayName, bin(TimeGenerated, 1h)
| where DistinctIPs > 1`,
  },
  {
    id: "bulk-directory-enum",
    title: "Bulk Directory Enumeration",
    description: "Detect high-volume directory queries (users, groups) originating from web app clients.",
    severity: "medium",
    query: `AuditLogs
| where OperationName == "List users" or OperationName == "List groups"
| where InitiatedBy.app.displayName in ("One Outlook Web", "Microsoft Teams Web Client")
| summarize count() by InitiatedBy.user.userPrincipalName, bin(TimeGenerated, 5m)
| where count_ > 50`,
  },
  {
    id: "msal-cache-extraction",
    title: "MSAL Cache Extraction Indicators",
    description: "Correlate sign-in events across different IPs for the same user and app, indicating extracted tokens used from a different location.",
    severity: "high",
    query: `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where TokenIssuerType == "AzureAD"
| summarize by UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress
| join kind=inner (
    SigninLogs | where AppDisplayName in ("One Outlook Web") | distinct UserPrincipalName, IPAddress
) on UserPrincipalName
| where IPAddress != IPAddress1`,
  },
]

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-400 border-sky-500/30",
}

export function KqlQueryPack() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          KQL Detection Queries
        </h3>
        <Badge variant="outline" className="text-[9px]">{KQL_QUERIES.length}</Badge>
      </div>

      <div className="space-y-2">
        {KQL_QUERIES.map((q) => (
          <KqlQueryCard key={q.id} query={q} />
        ))}
      </div>
    </div>
  )
}

function KqlQueryCard({ query }: { query: KqlQuery }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(query.query)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {query.title}
            <Badge className={`text-[9px] uppercase ${SEVERITY_COLORS[query.severity]}`}>
              {query.severity}
            </Badge>
          </CardTitle>
        </div>
        <CardDescription className="text-xs">{query.description}</CardDescription>
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
                <span>Copy</span>
              </>
            )}
          </button>
          <pre className="overflow-x-auto rounded border border-border/30 bg-black/30 p-3 text-[11px] font-mono text-muted-foreground leading-relaxed">
            {query.query}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
