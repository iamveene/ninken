"use client"

import { useState } from "react"
import { useGitHubOrgs } from "@/hooks/use-github"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Building2, Search } from "lucide-react"

export default function OrgsPage() {
  const [search, setSearch] = useState("")
  const { orgs, loading, error, refetch } = useGitHubOrgs()

  const filtered = orgs.filter(
    (o) =>
      !search ||
      o.login.toLowerCase().includes(search.toLowerCase()) ||
      (o.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orgs.length} organizations
          </p>
        </div>
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="github-orgs"
          columns={["login", "description"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            No organizations found
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Organization</TableHead>
                <TableHead className="text-xs">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {org.avatarUrl ? (
                        <img
                          src={org.avatarUrl}
                          alt={org.login}
                          className="h-6 w-6 rounded"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium">{org.login}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {org.description || "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
