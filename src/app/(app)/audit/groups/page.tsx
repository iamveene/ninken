"use client"

export default function GroupsAuditPage() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Groups Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect group memberships, access settings, and external sharing configurations.
        </p>
      </div>
    </div>
  )
}
