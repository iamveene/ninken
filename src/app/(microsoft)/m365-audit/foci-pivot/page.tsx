"use client"

import { AlertTriangle, CheckCircle2, Loader2, Shuffle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useFociPivot, type FociPivotResponse, type FociPivotResult } from "@/hooks/use-foci-pivot"

function classifyScope(scope: string): "write" | "admin" | "read" {
  const lower = scope.toLowerCase()
  if (
    lower.includes("write") ||
    lower.includes("send") ||
    lower.includes("create") ||
    lower.includes("delete")
  ) {
    return "write"
  }
  if (
    lower.includes("admin") ||
    lower.includes("manage") ||
    lower.includes("full") ||
    lower.includes("rolemanagement")
  ) {
    return "admin"
  }
  return "read"
}

function ScopeGroups({ scopes, credentialClientId, scopeMatrix }: {
  scopes: string[]
  credentialClientId: string
  scopeMatrix: Record<string, string[]>
}) {
  const grouped = { admin: [] as string[], write: [] as string[], read: [] as string[] }

  for (const scope of scopes) {
    grouped[classifyScope(scope)].push(scope)
  }

  // Determine which scopes are NOT available from the original client
  const originalScopes = new Set<string>()
  for (const [scope, clients] of Object.entries(scopeMatrix)) {
    if (clients.includes(credentialClientId)) {
      originalScopes.add(scope)
    }
  }

  const renderGroup = (title: string, items: string[], variant: "destructive" | "default" | "secondary") => {
    if (items.length === 0) return null
    return (
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{title} ({items.length})</h4>
        <div className="flex flex-wrap gap-1">
          {[...items].sort().map((scope) => {
            const isNew = !originalScopes.has(scope)
            return (
              <Badge
                key={scope}
                variant={isNew ? variant : "outline"}
                className={isNew ? "ring-1 ring-emerald-500/50" : ""}
              >
                {scope}
                {isNew && <span className="ml-1 text-[10px] opacity-75">NEW</span>}
              </Badge>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {renderGroup("Admin Scopes", grouped.admin, "destructive")}
      {renderGroup("Write Scopes", grouped.write, "default")}
      {renderGroup("Read Scopes", grouped.read, "secondary")}
    </div>
  )
}

function NotableCapabilitiesCell({ result }: { result: FociPivotResult }) {
  if (!result.success) {
    return <TableCell />
  }
  if (result.scopes.length === 0) {
    return (
      <TableCell>
        <span className="text-xs text-muted-foreground">No scopes decoded</span>
      </TableCell>
    )
  }

  const nonReadScopes = result.scopes.filter((s) => classifyScope(s) !== "read")

  return (
    <TableCell>
      <div className="flex flex-wrap gap-1 max-w-[300px]">
        {nonReadScopes.length === 0 ? (
          <span className="text-xs text-muted-foreground">Read-only</span>
        ) : (
          <>
            {nonReadScopes.slice(0, 5).map((scope) => (
              <Badge
                key={scope}
                variant={classifyScope(scope) === "admin" ? "destructive" : "default"}
                className="text-[10px]"
              >
                {scope}
              </Badge>
            ))}
            {nonReadScopes.length > 5 && (
              <Badge variant="outline" className="text-[10px]">
                +{nonReadScopes.length - 5} more
              </Badge>
            )}
          </>
        )}
      </div>
    </TableCell>
  )
}

function ResultsView({ data }: { data: FociPivotResponse }) {
  const successCount = data.results.filter((r) => r.success).length
  const failedCount = data.results.length - successCount

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{data.uniqueScopes.length}</p>
            <p className="text-xs text-muted-foreground">Unique Scopes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
            <p className="text-xs text-muted-foreground">Successful Exchanges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-red-400">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed Exchanges</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        {data.uniqueScopes.length} unique scope{data.uniqueScopes.length !== 1 ? "s" : ""} discovered
        across {successCount} successful exchange{successCount !== 1 ? "s" : ""}.
        Original client: <code className="text-xs bg-muted px-1 py-0.5 rounded">{data.credentialClientId}</code>
      </p>

      {/* Results table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Notable Capabilities</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.results.map((result) => (
            <TableRow key={result.clientId}>
              <TableCell>
                <div>
                  <p className="font-medium">{result.clientName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{result.clientId}</p>
                </div>
              </TableCell>
              <TableCell>
                {result.success ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Success</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-400">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">Failed</span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                {result.success ? (
                  <span className="text-sm">{result.scopes.length}</span>
                ) : (
                  <span className="text-xs text-muted-foreground max-w-[200px] truncate block" title={result.error}>
                    {result.error?.slice(0, 80) || "Unknown error"}
                  </span>
                )}
              </TableCell>
              <NotableCapabilitiesCell result={result} />
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Scope discovery breakdown */}
      {data.uniqueScopes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">All Discovered Scopes</h3>
          <ScopeGroups
            scopes={data.uniqueScopes}
            credentialClientId={data.credentialClientId}
            scopeMatrix={data.scopeMatrix}
          />
        </div>
      )}
    </div>
  )
}

export default function FociPivotPage() {
  const { results, loading, error, probe } = useFociPivot()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">FOCI Pivot Probe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Attempt refresh token exchange across all 16 FOCI (Family of Client IDs) applications
          to discover additional scopes and capabilities not available from the original client.
        </p>
      </div>

      {/* OPSEC warning */}
      <Card className="border-amber-500/30 bg-amber-950/10">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-200">OPSEC Warning</p>
            <p className="text-sm text-muted-foreground">
              FOCI pivoting generates 16 token acquisition events, one per FOCI client ID.
              These are visible in Azure AD sign-in logs and may trigger anomaly-based detections
              due to rapid multi-application token requests from a single refresh token.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trigger button */}
      <div>
        <Button
          onClick={probe}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shuffle className="h-4 w-4" />
          )}
          {loading ? "Probing FOCI clients..." : "Start FOCI Pivot Probe"}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">Probe failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && <ResultsView data={results} />}

      {/* Empty state before probe */}
      {!results && !loading && !error && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Shuffle className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">Ready to probe</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Click the button above to attempt token exchange across all FOCI family client IDs.
            Results will show which applications accepted the exchange and what scopes were granted.
          </p>
        </div>
      )}
    </div>
  )
}
