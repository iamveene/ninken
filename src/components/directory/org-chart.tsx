"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import type { DirectoryUser } from "@/hooks/use-directory"

type OrgChartProps = {
  users: DirectoryUser[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

type OrgNode = {
  user: DirectoryUser
  reports: OrgNode[]
}

function buildOrgTree(users: DirectoryUser[]): OrgNode[] {
  const emailToUser = new Map<string, DirectoryUser>()
  const emailToChildren = new Map<string, DirectoryUser[]>()
  const managedEmails = new Set<string>()

  for (const user of users) {
    emailToUser.set(user.primaryEmail, user)
  }

  for (const user of users) {
    const manager = user.relations?.find((r) => r.type === "manager")
    if (manager?.value) {
      const children = emailToChildren.get(manager.value) || []
      children.push(user)
      emailToChildren.set(manager.value, children)
      managedEmails.add(user.primaryEmail)
    }
  }

  function buildNode(user: DirectoryUser): OrgNode {
    const children = emailToChildren.get(user.primaryEmail) || []
    return {
      user,
      reports: children.map(buildNode),
    }
  }

  // Root nodes: users who are not managed by anyone in the list
  const roots = users.filter((u) => !managedEmails.has(u.primaryEmail))
  return roots.map(buildNode)
}

function OrgNodeView({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const org = node.user.organizations?.find((o) => o.primary) || node.user.organizations?.[0]

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 24 }}>
        {depth > 0 && (
          <span className="text-border">--</span>
        )}
        <Avatar size="sm">
          {node.user.thumbnailPhotoUrl && (
            <AvatarImage src={node.user.thumbnailPhotoUrl} alt={node.user.name.fullName} />
          )}
          <AvatarFallback>{getInitials(node.user.name.fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{node.user.name.fullName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {org?.title || node.user.primaryEmail}
          </p>
        </div>
      </div>
      {node.reports.map((child) => (
        <OrgNodeView key={child.user.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function OrgChart({ users }: OrgChartProps) {
  const tree = buildOrgTree(users)

  if (tree.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No organization data available.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <OrgNodeView key={node.user.id} node={node} />
      ))}
    </div>
  )
}
