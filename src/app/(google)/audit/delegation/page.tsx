"use client"

import { KeyRound, AlertCircle, Info } from "lucide-react"
import { useAuditDelegation } from "@/hooks/use-audit"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DelegationAuditPage() {
  const { delegations, note, loading, error } = useAuditDelegation()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Domain-Wide Delegation Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Service accounts with domain-wide delegation can impersonate any user. This is the highest-risk configuration in Google Workspace.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">Unable to load delegation data</p>
              <p className="text-sm text-muted-foreground">
                {error.includes("403") || error.includes("Authorized")
                  ? "Admin permissions and IAM API access are required to audit domain-wide delegation."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {note && (
            <Card className="border-amber-500/30 bg-amber-950/10">
              <CardContent className="flex items-center gap-3 py-4">
                <Info className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-amber-200">Implementation Note</p>
                  <p className="text-sm text-muted-foreground">{note}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {delegations.length === 0 && !note && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <KeyRound className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No domain-wide delegations found</p>
              <p className="text-sm text-muted-foreground">No service accounts with domain-wide delegation were detected.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
