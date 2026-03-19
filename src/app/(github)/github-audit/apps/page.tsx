"use client"

import { useState, useCallback } from "react"
import { useGitHubOrgs } from "@/hooks/use-github"
import { useCachedQuery } from "@/hooks/use-cached"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppWindow } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type Installation = {
  id: number
  appId: number
  appSlug: string
  targetType: string
  account: string
  permissions: Record<string, string>
  events: string[]
  repositorySelection: string
  createdAt: string
  updatedAt: string
}

export default function AppsAuditPage() {
  const { orgs, loading: orgsLoading } = useGitHubOrgs()
  const [selectedOrg, setSelectedOrg] = useState<string>("")

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/github/orgs/${selectedOrg}/installations`)
    if (!res.ok) throw new Error("Failed to fetch installations")
    const json = await res.json()
    return (json.installations ?? []) as Installation[]
  }, [selectedOrg])

  const cacheKey = selectedOrg ? `github:audit:apps:${selectedOrg}` : null
  const { data: installations, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <AppWindow className="h-5 w-5" />
            Installed Apps
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            GitHub Apps installed in your organizations
          </p>
        </div>
        {installations && installations.length > 0 && (
          <ExportButton
            data={installations as unknown as Record<string, unknown>[]}
            filename={`github-apps-${selectedOrg}`}
            columns={["appSlug", "repositorySelection", "createdAt"]}
          />
        )}
      </div>

      <Select value={selectedOrg} onValueChange={(v) => setSelectedOrg(v ?? "")}>
        <SelectTrigger className="w-[300px] h-8 text-xs">
          <SelectValue placeholder="Select an organization..." />
        </SelectTrigger>
        <SelectContent>
          {orgsLoading ? (
            <SelectItem value="_loading" disabled>Loading...</SelectItem>
          ) : orgs.length === 0 ? (
            <SelectItem value="_empty" disabled>No organizations available</SelectItem>
          ) : (
            orgs.map((o) => (
              <SelectItem key={o.id} value={o.login} className="text-xs">
                {o.login}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {!selectedOrg ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AppWindow className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select an organization to view installed apps
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">App</TableHead>
                <TableHead className="text-xs">Repo Access</TableHead>
                <TableHead className="text-xs">Permissions</TableHead>
                <TableHead className="text-xs">Events</TableHead>
                <TableHead className="text-xs">Installed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !installations || installations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No installed apps found
                  </TableCell>
                </TableRow>
              ) : (
                installations.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="text-xs font-medium">{app.appSlug}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          app.repositorySelection === "all"
                            ? "border-red-500/30 text-red-400"
                            : "border-blue-500/30 text-blue-400"
                        }`}
                      >
                        {app.repositorySelection}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(app.permissions).slice(0, 3).map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-[9px] px-1.5 py-0">
                            {k}: {v}
                          </Badge>
                        ))}
                        {Object.keys(app.permissions).length > 3 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            +{Object.keys(app.permissions).length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {app.events.slice(0, 2).map((e) => (
                          <Badge key={e} variant="secondary" className="text-[9px] px-1.5 py-0">
                            {e}
                          </Badge>
                        ))}
                        {app.events.length > 2 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            +{app.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
