"use client"

import { useState, useCallback } from "react"
import { useGitHubRepos, useGitHubOrgs } from "@/hooks/use-github"
import { useCachedQuery } from "@/hooks/use-cached"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Webhook, AlertTriangle } from "lucide-react"
import { CACHE_TTL_LIST } from "@/lib/cache"

type Hook = {
  id: number
  name: string
  active: boolean
  events: string[]
  url: string | null
  contentType: string | null
  insecureSsl: boolean
  createdAt: string
  updatedAt: string
}

export default function WebhooksAuditPage() {
  const { repos, loading: reposLoading } = useGitHubRepos()
  const { orgs, loading: orgsLoading } = useGitHubOrgs()
  const [mode, setMode] = useState<"repo" | "org">("repo")
  const [selected, setSelected] = useState<string>("")

  const fetcher = useCallback(async () => {
    let url: string
    if (mode === "org") {
      url = `/api/github/orgs/${selected}/hooks`
    } else {
      const [owner, repo] = selected.split("/")
      url = `/api/github/repos/${owner}/${repo}/hooks`
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error("Failed to fetch webhooks")
    const json = await res.json()
    return (json.hooks ?? []) as Hook[]
  }, [mode, selected])

  const cacheKey = selected ? `github:audit:webhooks:${mode}:${selected}` : null
  const { data: hooks, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configured webhooks for repos and orgs
          </p>
        </div>
        {hooks && hooks.length > 0 && (
          <ExportButton
            data={hooks as unknown as Record<string, unknown>[]}
            filename={`github-webhooks-${selected.replace("/", "-")}`}
            columns={["name", "active", "url", "events", "insecureSsl"]}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Button
            variant={mode === "repo" ? "default" : "outline"}
            size="sm"
            className="text-xs h-8"
            onClick={() => { setMode("repo"); setSelected("") }}
          >
            Repository
          </Button>
          <Button
            variant={mode === "org" ? "default" : "outline"}
            size="sm"
            className="text-xs h-8"
            onClick={() => { setMode("org"); setSelected("") }}
          >
            Organization
          </Button>
        </div>

        <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
          <SelectTrigger className="w-[300px] h-8 text-xs">
            <SelectValue placeholder={mode === "repo" ? "Select a repository..." : "Select an organization..."} />
          </SelectTrigger>
          <SelectContent>
            {mode === "repo" ? (
              reposLoading ? (
                <SelectItem value="_loading" disabled>Loading...</SelectItem>
              ) : repos.length === 0 ? (
                <SelectItem value="_empty" disabled>No repos</SelectItem>
              ) : (
                repos.map((r) => (
                  <SelectItem key={r.id} value={r.fullName} className="text-xs">
                    {r.fullName}
                  </SelectItem>
                ))
              )
            ) : orgsLoading ? (
              <SelectItem value="_loading" disabled>Loading...</SelectItem>
            ) : orgs.length === 0 ? (
              <SelectItem value="_empty" disabled>No orgs</SelectItem>
            ) : (
              orgs.map((o) => (
                <SelectItem key={o.id} value={o.login} className="text-xs">
                  {o.login}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {!selected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Webhook className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a {mode === "repo" ? "repository" : "organization"} to view webhooks
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">URL</TableHead>
                <TableHead className="text-xs">Active</TableHead>
                <TableHead className="text-xs">Events</TableHead>
                <TableHead className="text-xs">SSL</TableHead>
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
              ) : !hooks || hooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No webhooks found
                  </TableCell>
                </TableRow>
              ) : (
                hooks.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs font-medium">{h.name}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">
                        {h.url || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${h.active ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}
                      >
                        {h.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {h.events.slice(0, 3).map((e) => (
                          <Badge key={e} variant="secondary" className="text-[9px] px-1.5 py-0">
                            {e}
                          </Badge>
                        ))}
                        {h.events.length > 3 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            +{h.events.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {h.insecureSsl ? (
                        <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Insecure
                        </Badge>
                      ) : (
                        <span className="text-xs text-emerald-400">Secure</span>
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
