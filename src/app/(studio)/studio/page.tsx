"use client"

import { useState, useCallback, useMemo } from "react"
import { Key } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// Analyzer imports
import { TokenInput } from "@/components/studio/token-input"
import { AnalyzerResults } from "@/components/studio/token-analyzer/analyzer-results"
import { analyzeJwt, type JwtAnalysis } from "@/lib/studio/jwt-decoder"
import { identifyTokenType, type TokenTypeDefinition } from "@/lib/studio/token-types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Terminal, Shield } from "lucide-react"

// Converter imports
import {
  FOCI_CLIENTS,
  getFociClient,
  isFociClient,
  getFociClientsByVersatility,
} from "@/lib/studio/foci-clients"
import { cn } from "@/lib/utils"
import { ArrowRightLeft, Zap, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Scopes imports
import { ScopeSelector } from "@/components/studio/scope-calculator/scope-selector"
import { ReverseAnalyzer } from "@/components/studio/scope-calculator/reverse-analyzer"
import { GapAnalysis } from "@/components/studio/scope-calculator/gap-analysis"
import { ShieldCheck } from "lucide-react"

// MSAL imports
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { ExtractionGuide } from "@/components/studio/msal-extractor/extraction-guide"
import { ImportPanel } from "@/components/studio/msal-extractor/import-panel"
import { SnippetCard } from "@/components/studio/msal-extractor/snippet-card"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"

/* ── Analyzer Tab ─────────────────────────────────────────────────── */

function AnalyzerTab() {
  const [analysis, setAnalysis] = useState<JwtAnalysis | null>(null)
  const [tokenType, setTokenType] = useState<TokenTypeDefinition | null>(null)
  const [rawToken, setRawToken] = useState("")
  const [analyzed, setAnalyzed] = useState(false)

  const handleAnalyze = useCallback((token: string) => {
    setRawToken(token)
    const identified = identifyTokenType(token)
    setTokenType(identified)
    const jwtResult = analyzeJwt(token)
    setAnalysis(jwtResult)
    setAnalyzed(true)
  }, [])

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <TokenInput onAnalyze={handleAnalyze} />

      {analyzed && (
        <AnalyzerResults analysis={analysis} tokenType={tokenType} rawToken={rawToken} />
      )}

      {!analyzed && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <Card className="border-border/30 bg-card/30">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Supported Formats</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {["JWT", "OAuth2", "Refresh Token", "API Key", "SA Key JSON"].map((f) => (
                  <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/30">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Analysis Includes</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                <li>Platform detection (Google / Microsoft)</li>
                <li>Claims extraction and labeling</li>
                <li>Scope analysis with risk assessment</li>
                <li>Expiry countdown and OPSEC notes</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/30">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Privacy</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                All analysis is performed locally in the browser. Tokens are never transmitted to any server.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

/* ── Converter Tab ────────────────────────────────────────────────── */

function ConverterTab() {
  const [search, setSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const sortedClients = useMemo(() => {
    const clients = getFociClientsByVersatility()
    if (!search) return clients
    const lower = search.toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.clientId.toLowerCase().includes(lower) ||
        c.notableScopes.some((s) => s.toLowerCase().includes(lower))
    )
  }, [search])

  const copyClientId = (clientId: string) => {
    navigator.clipboard.writeText(clientId).then(() => {
      setCopiedId(clientId)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
  }

  const selected = selectedClient ? getFociClient(selectedClient) : null

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-amber-400" />
            FOCI Exchange Concept
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Microsoft first-party apps in the same FOCI family share refresh tokens. A refresh token obtained
            for Teams can be exchanged for an access token targeting Office, OneDrive, or any other FOCI member.
          </p>
          <div className="flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400/80">
              The /api/studio/exchange endpoint can perform FOCI token exchanges when a Microsoft credential is active.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search FOCI clients by name, client ID, or scope..." className="pl-8 h-8 text-xs" />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">FOCI Family Members</h2>
            <Badge variant="outline" className="text-[9px]">{sortedClients.length}</Badge>
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {sortedClients.map((client) => (
              <div
                key={client.clientId}
                role="button"
                tabIndex={0}
                className={cn(
                  "w-full flex items-start gap-3 rounded border px-3 py-2 text-left transition-colors cursor-pointer",
                  selectedClient === client.clientId ? "border-primary/50 bg-primary/5" : "border-border/30 bg-black/10 hover:border-border/60"
                )}
                onClick={() => setSelectedClient(client.clientId)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedClient(client.clientId) } }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{client.name}</span>
                    {client.commonlyAvailable ? (
                      <Badge variant="secondary" className="text-[8px] text-emerald-400 bg-emerald-500/10">Available</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px]">Limited</Badge>
                    )}
                    <Badge variant="outline" className="text-[8px] font-mono ml-auto">Family {client.familyId}</Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground truncate">{client.clientId}</span>
                    <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); copyClientId(client.clientId) }}>
                      {copiedId === client.clientId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.notableScopes.slice(0, 4).map((s) => (
                      <span key={s} className="text-[9px] font-mono text-muted-foreground bg-muted/30 rounded px-1 py-0.5">{s}</span>
                    ))}
                    {client.notableScopes.length > 4 && <span className="text-[9px] text-muted-foreground">+{client.notableScopes.length - 4}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {selected ? (
            <Card className="border-border/50 sticky top-0">
              <CardHeader>
                <CardTitle className="text-sm">{selected.name}</CardTitle>
                <CardDescription className="text-xs font-mono">{selected.clientId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Family ID</div><div className="font-mono">{selected.familyId}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Availability</div><div>{selected.commonlyAvailable ? "Commonly Available" : "Limited Availability"}</div></div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Notable Scopes</h3>
                  <div className="flex flex-wrap gap-1">{selected.notableScopes.map((s) => <Badge key={s} variant="secondary" className="text-[10px] font-mono">{s}</Badge>)}</div>
                </div>
                {selected.notes && (
                  <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <Shield className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-amber-400/80">{selected.notes}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Exchange Command</h3>
                  <div className="font-mono text-[10px] text-muted-foreground bg-black/30 rounded px-3 py-2 overflow-x-auto">
                    <pre>{`POST /api/studio/exchange\n{\n  "target_client_id": "${selected.clientId}",\n  "scope": "${selected.notableScopes.join(" ")}"\n}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                Select a FOCI client to view details and exchange commands.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Scopes Tab ───────────────────────────────────────────────────── */

function ScopesTab() {
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [platform, setPlatform] = useState<"all" | "google" | "microsoft">("all")

  const toggleScope = useCallback((scope: string) => {
    setSelectedScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope])
  }, [])

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-muted-foreground uppercase tracking-wider">Platform:</span>
        {(["all", "google", "microsoft"] as const).map((p) => (
          <button
            key={p}
            className={`px-2 py-1 rounded font-mono uppercase transition-colors ${platform === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            onClick={() => setPlatform(p)}
          >{p}</button>
        ))}
        {selectedScopes.length > 0 && (
          <button className="ml-auto px-2 py-1 rounded text-[10px] font-mono text-red-400 hover:bg-red-500/10 transition-colors" onClick={() => setSelectedScopes([])}>Clear All</button>
        )}
      </div>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div><ScopeSelector platform={platform} selectedScopes={selectedScopes} onToggleScope={toggleScope} /></div>
        <div className="space-y-4">
          <Tabs defaultValue="services">
            <TabsList><TabsTrigger value="services">Unlocked Services</TabsTrigger><TabsTrigger value="gaps">Gap Analysis</TabsTrigger></TabsList>
            <TabsContent value="services" className="mt-4"><ReverseAnalyzer selectedScopes={selectedScopes} /></TabsContent>
            <TabsContent value="gaps" className="mt-4"><GapAnalysis selectedScopes={selectedScopes} /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

/* ── MSAL Tab ─────────────────────────────────────────────────────── */

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

function ScopeCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="text-muted-foreground">{value}</span>
  return value ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-zinc-600" />
}

const KQL_SNIPPET = `SigninLogs
| where AppDisplayName in ("One Outlook Web", "Microsoft Teams Web Client")
| where ResourceDisplayName != "Microsoft Graph"
| project TimeGenerated, UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress`

function MsalTab() {
  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <Tabs defaultValue="owa">
        <TabsList><TabsTrigger value="owa">OWA (Outlook Web)</TabsTrigger><TabsTrigger value="teams">Teams Web</TabsTrigger></TabsList>
        <TabsContent value="owa" className="mt-4 space-y-5"><ExtractionGuide variant="owa" /><ImportPanel /></TabsContent>
        <TabsContent value="teams" className="mt-4 space-y-5"><ExtractionGuide variant="teams" /><ImportPanel /></TabsContent>
      </Tabs>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" />Scope Comparison: OWA vs Teams Web</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead className="text-xs">Feature</TableHead><TableHead className="text-xs">OWA (9199bf20)</TableHead><TableHead className="text-xs">Teams Web (5e3ce6c0)</TableHead></TableRow></TableHeader>
            <TableBody>
              {SCOPE_ROWS.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="text-xs font-mono">{row.feature}</TableCell>
                  <TableCell className="text-xs"><ScopeCell value={row.owa} /></TableCell>
                  <TableCell className="text-xs"><ScopeCell value={row.teams} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 flex gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Badge variant="secondary" className="text-[9px]">OWA</Badge>Directory + Chat + Files</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">Teams Web</Badge>Best target -- full M365</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" />Defender Detection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">KQL query for detecting SPA token extraction in Microsoft Defender / Sentinel.</p>
          <SnippetCard title="Detection KQL Query" description="Use in Microsoft Sentinel or Advanced Hunting" code={KQL_SNIPPET} />
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────── */

export default function TokenIntelligencePage() {
  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          Token Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analyze, convert, and manage OAuth2 tokens across platforms.
        </p>
      </div>

      <Tabs defaultValue="analyzer">
        <TabsList>
          <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
          <TabsTrigger value="converter">Converter</TabsTrigger>
          <TabsTrigger value="scopes">Scopes</TabsTrigger>
          <TabsTrigger value="msal">MSAL</TabsTrigger>
        </TabsList>

        <TabsContent value="analyzer" className="mt-4">
          <AnalyzerTab />
        </TabsContent>

        <TabsContent value="converter" className="mt-4">
          <ConverterTab />
        </TabsContent>

        <TabsContent value="scopes" className="mt-4">
          <ScopesTab />
        </TabsContent>

        <TabsContent value="msal" className="mt-4">
          <MsalTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
