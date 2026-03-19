"use client"

import { useGitHubUser, useGitHubRepos, useGitHubOrgs } from "@/hooks/use-github"
import { ServiceError } from "@/components/ui/service-error"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  BookMarked,
  Building2,
  Activity,
  User,
  Clock,
} from "lucide-react"

export default function GitHubAuditDashboardPage() {
  const { user, loading: userLoading, error: userError } = useGitHubUser()
  const { repos, loading: reposLoading } = useGitHubRepos()
  const { orgs, loading: orgsLoading } = useGitHubOrgs()

  if (userError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">GitHub Security Audit</h1>
        <ServiceError error={userError} />
      </div>
    )
  }

  const rateLimitRemaining = user?.rateLimit?.remaining ?? 0
  const rateLimitReset = user?.rateLimit?.reset
    ? new Date(user.rateLimit.reset * 1000).toLocaleTimeString()
    : "N/A"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          GitHub Security Audit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your GitHub security posture
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <User className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">
                {userLoading ? "-" : user?.login ?? "?"}
              </p>
              <p className="text-[10px] text-muted-foreground">User</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookMarked className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">
                {reposLoading ? "-" : repos.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Repos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {orgsLoading ? "-" : orgs.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Orgs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{rateLimitRemaining}</p>
              <p className="text-[10px] text-muted-foreground">Rate Limit</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-lg font-bold">{rateLimitReset}</p>
              <p className="text-[10px] text-muted-foreground">Reset At</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Token Info</h2>
        <Card>
          <CardContent className="p-4">
            {userLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : user ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-muted-foreground">Token Type</p>
                  <Badge variant="outline" className="text-[10px] font-mono mt-0.5">
                    {user.tokenType}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Account Type</p>
                  <p className="text-xs font-medium">{user.type}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">2FA</p>
                  <p className="text-xs font-medium">
                    {user.twoFactorAuthentication === true
                      ? "Enabled"
                      : user.twoFactorAuthentication === false
                        ? "Disabled"
                        : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Scopes</p>
                  <p className="text-xs font-medium">{user.scopes.length} granted</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No user data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {user && user.scopes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Scopes</h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {user.scopes.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-mono">
                    {s}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
