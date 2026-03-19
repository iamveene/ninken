"use client"

export default function UsersAuditPage() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Users Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review all user accounts, their status, last sign-in activity, and admin privileges.
        </p>
      </div>
    </div>
  )
}
