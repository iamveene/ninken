"use client"

import { toast } from "sonner"
import type { FociPivotResponse } from "@/hooks/use-foci-pivot"

/**
 * Fire-and-forget FOCI pivot probe after a FOCI credential is imported.
 * Shows a toast with the result summary and a link to the full results page.
 */
export function triggerFociAutoPivot() {
  // Show a loading toast that we'll update with results
  const toastId = toast.loading("FOCI Pivot: probing cross-app scopes...")

  fetch("/api/microsoft/audit/foci-pivot", { method: "POST" })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          (data as { error?: string }).error ||
            `FOCI pivot probe failed (${res.status})`,
        )
      }
      return res.json() as Promise<FociPivotResponse>
    })
    .then((data) => {
      const successCount = data.results.filter((r) => r.success).length
      toast.success("FOCI Pivot complete", {
        id: toastId,
        description: `Discovered ${data.uniqueScopes.length} scopes across ${successCount} apps`,
        action: {
          label: "View results",
          onClick: () => {
            window.location.href = "/m365-audit/foci-pivot"
          },
        },
        duration: 10000,
      })
    })
    .catch((err) => {
      toast.error("FOCI Pivot failed", {
        id: toastId,
        description:
          err instanceof Error ? err.message : "Could not probe FOCI clients",
        duration: 6000,
      })
    })
}
