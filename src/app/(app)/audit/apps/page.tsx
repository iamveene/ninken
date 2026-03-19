"use client"

export default function AppsAuditPage() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Apps Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit third-party app access, OAuth tokens, and API client authorizations in your workspace.
        </p>
      </div>
    </div>
  )
}
