"use client"

import { AppWindow, Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function M365AppsAuditPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">App Registrations Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entra ID application registrations, enterprise applications, and their permission grants.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-950/10">
        <CardContent className="flex items-center gap-3 py-4">
          <Info className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-medium text-amber-200">Coming Soon</p>
            <p className="text-sm text-muted-foreground">
              App registration and enterprise application enumeration will be implemented in a future release.
              This will include OAuth consent grants, API permissions, certificate/secret expiry, and multi-tenant app analysis.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AppWindow className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-lg font-medium">App registrations audit</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          This module will enumerate Entra ID app registrations, their API permissions,
          consent grants, credential expiry dates, and identify overprivileged applications.
        </p>
      </div>
    </div>
  )
}
