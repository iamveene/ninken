"use client"

import { useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  Globe,
  HardDrive,
  ListIcon,
  ArrowLeft,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useSharePointSites,
  useSharePointDrives,
  useSharePointLists,
} from "@/hooks/use-sharepoint"

function formatSize(bytes?: number): string {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function SharePointSiteDetailPage() {
  const params = useParams<{ siteId: string }>()
  const router = useRouter()
  const siteId = params.siteId ? decodeURIComponent(params.siteId) : null

  const { sites } = useSharePointSites()
  const site = sites.find((s) => s.id === siteId) ?? null

  const {
    drives,
    loading: drivesLoading,
    error: drivesError,
    refetch: refetchDrives,
  } = useSharePointDrives(siteId)

  const {
    lists,
    loading: listsLoading,
    error: listsError,
    refetch: refetchLists,
  } = useSharePointLists(siteId)

  // Filter out hidden lists
  const visibleLists = useMemo(() => lists.filter((l) => !l.list?.hidden), [lists])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/sharepoint")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            {site?.displayName ?? siteId ?? "Site"}
          </h1>
          {site?.webUrl && (
            <a
              href={site.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-0.5"
            >
              <ExternalLink className="h-3 w-3" />
              {site.webUrl}
            </a>
          )}
        </div>
      </div>

      {/* Document Libraries */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Document Libraries
        </h2>

        {drivesError && (
          <ServiceError error={drivesError} onRetry={refetchDrives} />
        )}

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Library</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Used</TableHead>
                <TableHead className="text-xs">Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : drives.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-xs text-muted-foreground py-6"
                  >
                    No document libraries found
                  </TableCell>
                </TableRow>
              ) : (
                drives.map((drive) => (
                  <TableRow
                    key={drive.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(
                        `/sharepoint/${encodeURIComponent(siteId!)}/drive/${encodeURIComponent(drive.id)}`,
                      )
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="text-xs font-medium">
                          {drive.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {drive.driveType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {drive.quota
                          ? `${formatSize(drive.quota.used)} / ${formatSize(drive.quota.total)}`
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {drive.lastModifiedDateTime
                          ? formatDistanceToNow(
                              new Date(drive.lastModifiedDateTime),
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
      </section>

      {/* Lists */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ListIcon className="h-4 w-4" />
          Lists
        </h2>

        {listsError && (
          <ServiceError error={listsError} onRetry={refetchLists} />
        )}

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">List Name</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Template</TableHead>
                <TableHead className="text-xs">Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleLists.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-xs text-muted-foreground py-6"
                  >
                    No lists found
                  </TableCell>
                </TableRow>
              ) : (
                visibleLists.map((list) => (
                  <TableRow
                    key={list.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(
                        `/sharepoint/${encodeURIComponent(siteId!)}/list/${encodeURIComponent(list.id)}`,
                      )
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ListIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="text-xs font-medium">
                          {list.displayName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {list.description || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {list.list?.template ?? "generic"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {list.lastModifiedDateTime
                          ? formatDistanceToNow(
                              new Date(list.lastModifiedDateTime),
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
      </section>
    </div>
  )
}
