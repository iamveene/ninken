"use client"

import { useGcpAuditFirewall } from "@/hooks/use-gcp-audit"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react"

const RISK_BADGE: Record<string, { border: string; text: string; label: string }> = {
  critical: { border: "border-red-500/30", text: "text-red-400", label: "Critical" },
  high: { border: "border-amber-500/30", text: "text-amber-400", label: "High" },
  medium: { border: "border-yellow-500/30", text: "text-yellow-400", label: "Medium" },
  low: { border: "border-emerald-500/30", text: "text-emerald-400", label: "Low" },
}

export default function GcpFirewallPage() {
  const { rules, loading, error, refetch } = useGcpAuditFirewall()

  const openRules = rules.filter((r) => r.isOpenToWorld)
  const criticalRules = rules.filter((r) => r.riskLevel === "critical")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Firewall Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            VPC firewall rules with risk analysis
          </p>
        </div>
        <ExportButton
          data={rules as unknown as Record<string, unknown>[]}
          filename="gcp-audit-firewall"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{rules.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${openRules.length > 0 ? "text-amber-400" : ""}`}>
              {openRules.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Open to World</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${criticalRules.length > 0 ? "text-red-400" : ""}`}>
              {criticalRules.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Critical Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {rules.length - openRules.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Restricted</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Rule Name</TableHead>
              <TableHead className="text-xs">Network</TableHead>
              <TableHead className="text-xs">Source Ranges</TableHead>
              <TableHead className="text-xs">Allowed Ports</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                  No firewall rules found
                </TableCell>
              </TableRow>
            ) : (
              [...rules]
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 }
                  return order[a.riskLevel] - order[b.riskLevel]
                })
                .map((rule) => {
                  const risk = RISK_BADGE[rule.riskLevel]
                  return (
                    <TableRow key={rule.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">{rule.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.network}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.sourceRanges.map((sr) => (
                            <Badge
                              key={sr}
                              variant="outline"
                              className={`text-[9px] ${
                                sr === "0.0.0.0/0" || sr === "::/0"
                                  ? "border-red-500/30 text-red-400"
                                  : ""
                              }`}
                            >
                              {sr}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.allowed
                          .map((a) => `${a.protocol}:${a.ports.join(",")}`)
                          .join("; ")}
                      </TableCell>
                      <TableCell>
                        {rule.isOpenToWorld ? (
                          <Badge variant="outline" className={`text-[9px] ${risk.border} ${risk.text}`}>
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {risk.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> {risk.label}
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
    </div>
  )
}
