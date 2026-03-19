"use client"

import { AppWindow, AlertCircle, Info } from "lucide-react"
import { useAuditApps } from "@/hooks/use-audit"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AppsAuditPage() {
  const { apps, note, loading, error } = useAuditApps()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">OAuth Apps Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Third-party applications users have authorized with OAuth access to their data.
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
              <p className="font-medium">Unable to load OAuth app data</p>
              <p className="text-sm text-muted-foreground">
                {error.includes("403") || error.includes("Authorized")
                  ? "Admin permissions are required to audit OAuth app grants across the organization."
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

          {apps.length === 0 && !note && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <AppWindow className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No OAuth apps found</p>
              <p className="text-sm text-muted-foreground">No third-party applications have been authorized.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
