"use client"

export default function AuditDashboardPage() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Audit Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your Google Workspace security posture, user access, and delegation status.
        </p>
      </div>
    </div>
  )
}
