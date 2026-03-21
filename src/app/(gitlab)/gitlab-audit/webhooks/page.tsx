"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Webhook } from "lucide-react"

export default function GitLabAuditWebhooksPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Webhooks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enumerate webhooks configured on projects and groups
        </p>
      </div>
      <Card>
        <CardContent className="p-8 text-center">
          <Webhook className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Webhook enumeration coming soon.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Will enumerate project and group webhooks, their URLs, events, and SSL verification settings.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
