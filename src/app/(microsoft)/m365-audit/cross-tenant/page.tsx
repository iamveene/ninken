"use client"

import { useMemo } from "react"
import { ArrowLeftRight, AlertCircle, ShieldCheck } from "lucide-react"
import { useCrossTenantAccess, type CrossTenantInboundTrust } from "@/hooks/use-m365-audit"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { ExportButton } from "@/components/layout/export-button"

function TrustBadge({ label, enabled }: { label: string; enabled?: boolean }) {
  if (enabled === undefined || enabled === null) {
    return (
      <Badge variant="outline">{label}: N/A</Badge>
    )
  }
  return enabled ? (
    <Badge variant="default">{label}</Badge>
  ) : (
    <Badge variant="destructive">{label}</Badge>
  )
}

function summarizeTrustSettings(trust?: CrossTenantInboundTrust): string {
  if (!trust) return "Not configured"
  const parts: string[] = []
  if (trust.isMfaAccepted) parts.push("MFA")
  if (trust.isCompliantDeviceAccepted) parts.push("Compliant")
  if (trust.isHybridAzureADJoinedDeviceAccepted) parts.push("Hybrid-Joined")
  return parts.length > 0 ? parts.join(", ") : "None accepted"
}

function summarizeB2bAccess(
  inbound?: Record<string, unknown>,
  outbound?: Record<string, unknown>
): string {
  const hasInbound = inbound && Object.keys(inbound).length > 0
  const hasOutbound = outbound && Object.keys(outbound).length > 0
  if (hasInbound && hasOutbound) return "Inbound + Outbound"
  if (hasInbound) return "Inbound only"
  if (hasOutbound) return "Outbound only"
  return "Not configured"
}

function B2bSection({
  title,
  inbound,
  outbound,
}: {
  title: string
  inbound?: Record<string, unknown>
  outbound?: Record<string, unknown>
}) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Inbound</p>
          {inbound && Object.keys(inbound).length > 0 ? (
            <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-40">
              {JSON.stringify(inbound, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Default (not customized)</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Outbound</p>
          {outbound && Object.keys(outbound).length > 0 ? (
            <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-40">
              {JSON.stringify(outbound, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Default (not customized)</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CrossTenantAccessPage() {
  const { defaultPolicy, partners, loading, error } = useCrossTenantAccess()

  const is403 =
    error?.includes("403") ||
    error?.includes("Forbidden") ||
    error?.includes("Authorization")

  const stats = useMemo(() => {
    const total = partners.length
    const serviceProviders = partners.filter((p) => p.isServiceProvider).length
    const trustMfa = partners.filter((p) => p.inboundTrust?.isMfaAccepted).length
    return { total, serviceProviders, trustMfa }
  }, [partners])

  const exportData = useMemo(() => {
    return partners.map((p) => ({
      tenantId: p.tenantId,
      inboundTrust: summarizeTrustSettings(p.inboundTrust),
      b2bCollaboration: summarizeB2bAccess(
        p.b2bCollaborationInbound,
        p.b2bCollaborationOutbound
      ),
      b2bDirectConnect: summarizeB2bAccess(
        p.b2bDirectConnectInbound,
        p.b2bDirectConnectOutbound
      ),
      isServiceProvider: p.isServiceProvider ? "Yes" : "No",
    }))
  }, [partners])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Cross-Tenant Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review cross-tenant access policies including B2B collaboration settings, partner overrides, and trust configurations.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="m365-cross-tenant-access"
          disabled={loading || partners.length === 0}
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">
                {is403 ? "Insufficient permissions" : "Unable to load cross-tenant access policy"}
              </p>
              <p className="text-sm text-muted-foreground">
                {is403
                  ? "Policy.Read.All permission is required to access cross-tenant access policies."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {/* Default Policy Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowLeftRight className="h-4 w-4" />
                Default Policy (Baseline for All External Organizations)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Inbound Trust */}
              <div>
                <h3 className="text-sm font-medium mb-2">Inbound Trust Settings</h3>
                <div className="flex flex-wrap gap-2">
                  <TrustBadge
                    label="Accepts External MFA"
                    enabled={defaultPolicy?.inboundTrust?.isMfaAccepted}
                  />
                  <TrustBadge
                    label="Accepts Compliant Device"
                    enabled={defaultPolicy?.inboundTrust?.isCompliantDeviceAccepted}
                  />
                  <TrustBadge
                    label="Accepts Hybrid Azure AD Joined"
                    enabled={defaultPolicy?.inboundTrust?.isHybridAzureADJoinedDeviceAccepted}
                  />
                </div>
              </div>

              {/* B2B Collaboration */}
              <B2bSection
                title="B2B Collaboration"
                inbound={defaultPolicy?.b2bCollaborationInbound}
                outbound={defaultPolicy?.b2bCollaborationOutbound}
              />

              {/* B2B Direct Connect */}
              <B2bSection
                title="B2B Direct Connect"
                inbound={defaultPolicy?.b2bDirectConnectInbound}
                outbound={defaultPolicy?.b2bDirectConnectOutbound}
              />
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Partner Overrides</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Service Providers</p>
                <p className="text-2xl font-bold">{stats.serviceProviders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Trust MFA</p>
                <p className="text-2xl font-bold">{stats.trustMfa}</p>
              </CardContent>
            </Card>
          </div>

          {/* Partners Table */}
          {partners.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No partner overrides configured</p>
              <p className="text-sm text-muted-foreground">
                All external organizations use the default cross-tenant access policy.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead>Inbound Trust</TableHead>
                    <TableHead>B2B Collaboration</TableHead>
                    <TableHead>B2B Direct Connect</TableHead>
                    <TableHead>Service Provider</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.tenantId}>
                      <TableCell className="font-mono text-sm">
                        {partner.tenantId}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <TrustBadge
                            label="MFA"
                            enabled={partner.inboundTrust?.isMfaAccepted}
                          />
                          <TrustBadge
                            label="Compliant"
                            enabled={partner.inboundTrust?.isCompliantDeviceAccepted}
                          />
                          <TrustBadge
                            label="Hybrid"
                            enabled={partner.inboundTrust?.isHybridAzureADJoinedDeviceAccepted}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {summarizeB2bAccess(
                          partner.b2bCollaborationInbound,
                          partner.b2bCollaborationOutbound
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {summarizeB2bAccess(
                          partner.b2bDirectConnectInbound,
                          partner.b2bDirectConnectOutbound
                        )}
                      </TableCell>
                      <TableCell>
                        {partner.isServiceProvider ? (
                          <Badge variant="secondary">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
