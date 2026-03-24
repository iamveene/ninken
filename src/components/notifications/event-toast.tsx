"use client"

import { useEvents } from "@/hooks/use-events"
import { toast } from "sonner"

const EVENT_LABELS: Record<string, string> = {
  audit_progress: "Audit",
  extraction_progress: "Extraction",
  vault_change: "Vault",
  profile_status: "Profile",
}

export function EventToast() {
  useEvents({
    extraction_progress: (event) => {
      toast(
        `${EVENT_LABELS.extraction_progress}: ${(event.payload.status as string) || "Updated"}`,
        {
          description:
            (event.payload.message as string) ||
            "Extraction progress updated",
        },
      )
    },
    vault_change: (event) => {
      toast(
        `${EVENT_LABELS.vault_change}: ${(event.payload.action as string) || "Updated"}`,
        {
          description:
            (event.payload.message as string) || "Vault updated",
        },
      )
    },
    audit_progress: (event) => {
      toast(
        `${EVENT_LABELS.audit_progress}: ${(event.payload.status as string) || "Updated"}`,
        {
          description:
            (event.payload.message as string) ||
            "Audit progress updated",
        },
      )
    },
  })

  return null
}
