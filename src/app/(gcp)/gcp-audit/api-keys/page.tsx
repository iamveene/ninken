"use client"

import { useGcpAuditApiKeys } from "@/hooks/use-gcp-audit"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Key, AlertTriangle, CheckCircle2, ShieldAlert, Info } from "lucide-react"

export default function GcpApiKeysPage() {
  const { keys, unavailable, message, loading, error, refetch } = useGcpAuditApiKeys()

  const unrestricted = keys.filter(
    (k) => !k.hasApplicationRestrictions && !k.hasApiRestrictions,
  )
  const partiallyRestricted = keys.filter(
    (k) =>
      (k.hasApplicationRestrictions || k.hasApiRestrictions) &&
      !(k.hasApplicationRestrictions && k.hasApiRestrictions),
  )
  const fullyRestricted = keys.filter(
    (k) => k.hasApplicationRestrictions && k.hasApiRestrictions,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key Security
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            API key restriction and security analysis
          </p>
        </div>
        {keys.length > 0 && (
          <ExportButton
            data={keys as unknown as Record<string, unknown>[]}
            filename="gcp-audit-api-keys"
          />
        )}
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {unavailable ? (
        <Card className="border-amber-500/30 bg-amber-950/10">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-400" />
              API Keys API Not Accessible
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {message || "The current API key does not have access to the API Keys API (apikeys.googleapis.com). This API must be enabled in the project and the key must not have API restrictions blocking it."}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              To audit API key restrictions, ensure the API Keys API is enabled and accessible.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${unrestricted.length > 0 ? "text-red-400" : ""}`}>
                  {unrestricted.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Unrestricted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${partiallyRestricted.length > 0 ? "text-amber-400" : ""}`}>
                  {partiallyRestricted.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Partial Restrictions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {fullyRestricted.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Fully Restricted</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Key Name</TableHead>
                  <TableHead className="text-xs">Application Restrictions</TableHead>
                  <TableHead className="text-xs">API Restrictions</TableHead>
                  <TableHead className="text-xs">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                      No API keys found
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((key) => {
                    const isUnrestricted = !key.hasApplicationRestrictions && !key.hasApiRestrictions
                    const isPartial = (key.hasApplicationRestrictions || key.hasApiRestrictions) && !(key.hasApplicationRestrictions && key.hasApiRestrictions)
                    const keyDisplayName = key.displayName || key.name.split("/").pop() || key.name

                    return (
                      <TableRow key={key.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Key className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">{keyDisplayName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {key.hasApplicationRestrictions ? (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Set
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> None
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {key.hasApiRestrictions ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> {key.apiTargets?.length ?? 0} APIs
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> All APIs
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isUnrestricted ? (
                            <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                              <ShieldAlert className="h-2.5 w-2.5 mr-0.5" /> Critical
                            </Badge>
                          ) : isPartial ? (
                            <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                              Medium
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Low
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
