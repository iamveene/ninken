"use client"

import Link from "next/link"
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  KeyRound,
  AlertCircle,
  ArrowRight,
  AppWindow,
  KeySquare,
} from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuditUsers, useAuditGroups, useAuditRoles } from "@/hooks/use-audit"
import type { LucideIcon } from "lucide-react"

type RiskColor = "blue" | "red" | "amber"

type StatCard = {
  label: string
  value: number | null
  icon: LucideIcon
  color: RiskColor
  loading: boolean
}

const colorMap: Record<RiskColor, { border: string; icon: string; bg: string }> = {
  blue: {
    border: "border-l-blue-500",
    icon: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  red: {
    border: "border-l-red-500",
    icon: "text-red-400",
    bg: "bg-red-500/10",
  },
  amber: {
    border: "border-l-amber-500",
    icon: "text-amber-400",
    bg: "bg-amber-500/10",
  },
}

const quickLinks = [
  { label: "Users", href: "/audit/users", icon: Users },
  { label: "Groups", href: "/audit/groups", icon: UsersRound },
  { label: "Roles", href: "/audit/roles", icon: ShieldCheck },
  { label: "Apps", href: "/audit/apps", icon: AppWindow },
  { label: "Delegation", href: "/audit/delegation", icon: KeySquare },
]

function isPermissionError(err: string | null): boolean {
  return (
    err != null &&
    (err.includes("403") ||
      err.includes("Forbidden") ||
      err.includes("insufficient") ||
      err.includes("scope") ||
      err.includes("disabled") ||
      err.includes("Enable it"))
  )
}

function StatCardItem({ card }: { card: StatCard }) {
  const colors = colorMap[card.color]
  const Icon = card.icon

  return (
    <Card className={`border-l-4 ${colors.border}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {card.label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {card.loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-3xl font-bold tracking-tight">
            {card.value ?? "--"}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

export default function AuditDashboardPage() {
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
  } = useAuditUsers()

  const {
    data: groupsData,
    loading: groupsLoading,
    error: groupsError,
  } = useAuditGroups()

  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useAuditRoles()

  const permissionDenied =
    isPermissionError(usersError) ||
    isPermissionError(groupsError) ||
    isPermissionError(rolesError)

  const anyError = usersError || groupsError || rolesError
  const hasNonPermError = anyError && !permissionDenied

  const users = usersData.users
  const totalUsers = usersLoading ? null : users.length
  const usersWithout2FA = usersLoading
    ? null
    : users.filter((u) => !u.isEnrolledIn2Sv && !u.suspended).length
  const adminUsers = usersLoading
    ? null
    : users.filter((u) => u.isAdmin || u.isDelegatedAdmin).length
  const totalGroups = groupsLoading ? null : groupsData.groups.length
  const rolesAssigned = rolesLoading
    ? null
    : rolesData.roles.reduce((sum, r) => sum + r.assignees.length, 0)

  const cards: StatCard[] = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "blue",
      loading: usersLoading,
    },
    {
      label: "Users without 2FA",
      value: usersWithout2FA,
      icon: ShieldAlert,
      color: "red",
      loading: usersLoading,
    },
    {
      label: "Admin Users",
      value: adminUsers,
      icon: ShieldCheck,
      color: "amber",
      loading: usersLoading,
    },
    {
      label: "Total Groups",
      value: totalGroups,
      icon: UsersRound,
      color: "blue",
      loading: groupsLoading,
    },
    {
      label: "Roles Assigned",
      value: rolesAssigned,
      icon: KeyRound,
      color: "amber",
      loading: rolesLoading,
    },
  ]

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col overflow-hidden">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Audit Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your Google Workspace security posture, user access, and
          delegation status.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {permissionDenied ? (
          <div className="py-12 flex justify-center">
            <Card className="max-w-md border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Access denied
                </CardTitle>
                <CardDescription>
                  Audit dashboard requires administrator permissions. Contact
                  your workspace admin for access.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <>
            {hasNonPermError && (
              <div className="mb-4 flex justify-center">
                <Card className="max-w-md border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Failed to load some data
                    </CardTitle>
                    <CardDescription>
                      {usersError || groupsError || rolesError}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <StatCardItem key={card.label} card={card} />
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Quick Links
              </h2>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50 hover:border-border"
                  >
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{link.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
