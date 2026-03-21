"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ExtractionGuide } from "@/components/studio/msal-extractor/extraction-guide"
import { ImportPanel } from "@/components/studio/msal-extractor/import-panel"
import { SnippetCard } from "@/components/studio/msal-extractor/snippet-card"
import { Key, Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

const SCOPE_ROWS = [
  { feature: "Graph Scopes", owa: "26", teams: "30" },
  { feature: "Mail.Read", owa: false, teams: true },
  { feature: "Mail.ReadWrite", owa: false, teams: true },
  { feature: "Calendars.ReadWrite", owa: false, teams: true },
  { feature: "Sites.ReadWrite.All", owa: false, teams: true },
  { feature: "Notes.ReadWrite", owa: false, teams: true },
  { feature: "Tasks.ReadWrite", owa: false, teams: true },
  { feature: "Server Refresh", owa: "No (SPA-bound)", teams: "No (SPA-bound)" },
  { feature: "FOCI", owa: false, teams: false },
] as const

const KQL_SNIPPET = `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where ResourceDisplayName != "Microsoft Graph"
| project TimeGenerated, UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress`

function ScopeCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-muted-foreground">{value}</span>
  }
  return value ? (
    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-zinc-600" />
  )
}

export default function MsalExtractorPage() {
  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          MSAL Token Extractor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guided walkthrough for extracting MSAL tokens from OWA and Teams Web
          browser sessions. Extracts SPA-bound refresh tokens from localStorage
          for import into Ninken.
        </p>
      </div>

      <Tabs defaultValue="owa">
        <TabsList>
          <TabsTrigger value="owa">OWA (Outlook Web)</TabsTrigger>
          <TabsTrigger value="teams">Teams Web</TabsTrigger>
        </TabsList>

        <TabsContent value="owa" className="mt-4 space-y-5">
          <ExtractionGuide variant="owa" />
          <ImportPanel />
        </TabsContent>

        <TabsContent value="teams" className="mt-4 space-y-5">
          <ExtractionGuide variant="teams" />
          <ImportPanel />
        </TabsContent>
      </Tabs>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Scope Comparison: OWA vs Teams Web
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Feature</TableHead>
                <TableHead className="text-xs">OWA (9199bf20)</TableHead>
                <TableHead className="text-xs">Teams Web (5e3ce6c0)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCOPE_ROWS.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="text-xs font-mono">
                    {row.feature}
                  </TableCell>
                  <TableCell className="text-xs">
                    <ScopeCell value={row.owa} />
                  </TableCell>
                  <TableCell className="text-xs">
                    <ScopeCell value={row.teams} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-3 flex gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[9px]">
                OWA
              </Badge>
              Directory + Chat + Files
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">
                Teams Web
              </Badge>
              Best target -- full M365
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Defender Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            KQL query for detecting SPA token extraction in Microsoft Defender /
            Sentinel. Monitors for sign-in activity from OWA and Teams Web
            clients accessing non-Graph resources, which may indicate token
            reuse or scope expansion.
          </p>
          <SnippetCard
            title="Detection KQL Query"
            description="Use in Microsoft Sentinel or Advanced Hunting"
            code={KQL_SNIPPET}
          />
        </CardContent>
      </Card>
    </div>
  )
}
