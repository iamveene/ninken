"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Globe, Search, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceError } from "@/components/ui/service-error"
import { ExportButton } from "@/components/layout/export-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSharePointSites } from "@/hooks/use-sharepoint"

export default function SharePointSitesPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const { sites, loading, error, refetch } = useSharePointSites(
    search.trim() || undefined,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            SharePoint Sites
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sites.length} sites accessible
          </p>
        </div>
        <ExportButton
          data={sites as unknown as Record<string, unknown>[]}
          filename="sharepoint-sites"
          columns={["displayName", "name", "webUrl", "lastModifiedDateTime"]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Site Name</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">URL</TableHead>
              <TableHead className="text-xs">Last Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sites.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-xs text-muted-foreground py-8"
                >
                  {search.trim()
                    ? "No sites match your search"
                    : "No SharePoint sites found"}
                </TableCell>
              </TableRow>
            ) : (
              sites.map((site) => (
                <TableRow
                  key={site.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(
                      `/sharepoint/${encodeURIComponent(site.id)}`,
                    )
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="text-xs font-medium">
                        {site.displayName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {site.description || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a
                      href={site.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {site.webUrl}
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {site.lastModifiedDateTime
                        ? formatDistanceToNow(
                            new Date(site.lastModifiedDateTime),
                            { addSuffix: true },
                          )
                        : "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
