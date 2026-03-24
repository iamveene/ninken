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
import { Users } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type OrgMember = {
  login: string
  id: number
  avatarUrl: string
  htmlUrl: string
  type: string
  siteAdmin: boolean
}

export default function MembersAuditPage() {
  const { orgs, loading: orgsLoading } = useGitHubOrgs()
  const [selectedOrg, setSelectedOrg] = useState<string>("")

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/github/orgs/${selectedOrg}/members`)
    if (!res.ok) throw new Error("Failed to fetch members")
    const json = await res.json()
    return (json.members ?? []) as OrgMember[]
  }, [selectedOrg])

  const cacheKey = selectedOrg ? `github:audit:members:${selectedOrg}` : null
  const { data: members, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members & Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organization members and their roles
          </p>
        </div>
        {members && members.length > 0 && (
          <ExportButton
            data={members as unknown as Record<string, unknown>[]}
            filename={`github-members-${selectedOrg}`}
            columns={["login", "type", "siteAdmin"]}
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
            <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select an organization to view its members
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Site Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !members || members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                    No members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <a
                        href={m.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {m.login}
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{m.type}</span>
                    </TableCell>
                    <TableCell>
                      {m.siteAdmin ? (
                        <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
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
