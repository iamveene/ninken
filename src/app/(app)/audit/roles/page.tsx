"use client"

export default function RolesAuditPage() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Roles Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review admin roles, custom role definitions, and privilege assignments across the workspace.
        </p>
      </div>
    </div>
  )
}
