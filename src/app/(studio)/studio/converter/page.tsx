"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  FOCI_CLIENTS,
  getFociClient,
  isFociClient,
  getFociClientsByVersatility,
} from "@/lib/studio/foci-clients"
import { cn } from "@/lib/utils"
import { ArrowRightLeft, Search, Zap, Shield, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TokenConverterPage() {
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
    }).catch(() => {
      // Clipboard access denied
    })
  }

  const selected = selectedClient ? getFociClient(selectedClient) : null

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          Token Converter (FOCI)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Family of Client IDs (FOCI) reference. Exchange refresh tokens across Microsoft first-party applications
          within the same family to gain additional scope coverage.
        </p>
      </div>

      {/* FOCI Overview */}
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
            for Teams can be exchanged for an access token targeting Office, OneDrive, or any other FOCI member
            -- potentially gaining scopes the original app did not request.
          </p>
          <div className="flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400/80">
              The /api/studio/exchange endpoint can perform FOCI token exchanges when a Microsoft credential is active.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search FOCI clients by name, client ID, or scope..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Client list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              FOCI Family Members
            </h2>
            <Badge variant="outline" className="text-[9px]">{sortedClients.length}</Badge>
          </div>

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {sortedClients.map((client) => (
              <button
                key={client.clientId}
                className={cn(
                  "w-full flex items-start gap-3 rounded border px-3 py-2 text-left transition-colors",
                  selectedClient === client.clientId
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/30 bg-black/10 hover:border-border/60"
                )}
                onClick={() => setSelectedClient(client.clientId)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{client.name}</span>
                    {client.commonlyAvailable ? (
                      <Badge variant="secondary" className="text-[8px] text-emerald-400 bg-emerald-500/10">Available</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px]">Limited</Badge>
                    )}
                    <Badge variant="outline" className="text-[8px] font-mono ml-auto">
                      Family {client.familyId}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {client.clientId}
                    </span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyClientId(client.clientId)
                      }}
                    >
                      {copiedId === client.clientId ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.notableScopes.slice(0, 4).map((s) => (
                      <span key={s} className="text-[9px] font-mono text-muted-foreground bg-muted/30 rounded px-1 py-0.5">
                        {s}
                      </span>
                    ))}
                    {client.notableScopes.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">+{client.notableScopes.length - 4}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <Card className="border-border/50 sticky top-0">
              <CardHeader>
                <CardTitle className="text-sm">{selected.name}</CardTitle>
                <CardDescription className="text-xs font-mono">{selected.clientId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Family ID</div>
                    <div className="font-mono">{selected.familyId}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Availability</div>
                    <div>{selected.commonlyAvailable ? "Commonly Available" : "Limited Availability"}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                    Notable Scopes
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {selected.notableScopes.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] font-mono">{s}</Badge>
                    ))}
                  </div>
                </div>

                {selected.notes && (
                  <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <Shield className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-amber-400/80">{selected.notes}</span>
                  </div>
                )}

                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                    Exchange Command
                  </h3>
                  <div className="font-mono text-[10px] text-muted-foreground bg-black/30 rounded px-3 py-2 overflow-x-auto">
                    <pre>{`POST /api/studio/exchange
{
  "target_client_id": "${selected.clientId}",
  "scope": "${selected.notableScopes.join(" ")}"
}`}</pre>
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
