"use client"

import { useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Folder,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  File,
  Search,
  ChevronRight,
  Home,
  ArrowLeft,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceError } from "@/components/ui/service-error"
import { CollectButton } from "@/components/collection/collect-button"
import type { CollectParams } from "@/hooks/use-collect-action"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useSharePointDriveItems,
  useSharePointDrives,
  type SharePointDriveItem,
} from "@/hooks/use-sharepoint"

type BreadcrumbSegment = { id: string; name: string }

function getFileIcon(item: SharePointDriveItem) {
  if (item.folder) return { icon: Folder, color: "text-amber-500" }
  const mime = item.file?.mimeType || ""
  const ext = item.name.split(".").pop()?.toLowerCase() || ""
  if (mime.startsWith("image/")) return { icon: FileImage, color: "text-pink-500" }
  if (mime.startsWith("video/")) return { icon: FileVideo, color: "text-purple-500" }
  if (mime.startsWith("audio/")) return { icon: FileAudio, color: "text-green-500" }
  if (mime.includes("spreadsheet") || ext === "xlsx" || ext === "csv")
    return { icon: FileSpreadsheet, color: "text-emerald-500" }
  if (mime.includes("document") || mime.includes("pdf") || ext === "docx" || ext === "pdf")
    return { icon: FileText, color: "text-blue-500" }
  return { icon: File, color: "text-muted-foreground" }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function collectParamsForItem(
  siteId: string,
  driveId: string,
  item: SharePointDriveItem,
): CollectParams {
  const isFolder = !!item.folder
  return {
    type: isFolder ? "folder" : "file",
    source: "onedrive",
    title: item.name,
    subtitle: item.lastModifiedBy?.user?.displayName,
    sourceId: `sharepoint:${siteId}:${driveId}:${item.id}`,
    downloadUrl: isFolder ? undefined : `/api/microsoft/sharepoint/sites/${siteId}/drives/${driveId}/items/${item.id}/download`,
    mimeType: isFolder ? undefined : item.file?.mimeType,
    sizeBytes: isFolder ? undefined : item.size,
    metadata: {
      mimeType: item.file?.mimeType,
      lastModifiedDateTime: item.lastModifiedDateTime,
      webUrl: item.webUrl,
      sharePointSiteId: siteId,
      driveId,
      ...(isFolder ? { childCount: item.folder?.childCount } : {}),
    },
  }
}

export default function SharePointDriveBrowserPage() {
  const params = useParams<{ siteId: string; driveId: string }>()
  const router = useRouter()
  const siteId = params.siteId ? decodeURIComponent(params.siteId) : null
  const driveId = params.driveId ? decodeURIComponent(params.driveId) : null

  const [folderId, setFolderId] = useState<string | undefined>()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([])
  const [searchFilter, setSearchFilter] = useState("")

  const { drives } = useSharePointDrives(siteId)
  const drive = drives.find((d) => d.id === driveId) ?? null

  const { items, loading, error, refetch } = useSharePointDriveItems(
    siteId,
    driveId,
    folderId,
  )

  // Client-side filter
  const filtered = searchFilter.trim()
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchFilter.toLowerCase()),
      )
    : items

  // Sort: folders first, then by name
  const sorted = [...filtered].sort((a, b) => {
    if (a.folder && !b.folder) return -1
    if (!a.folder && b.folder) return 1
    return a.name.localeCompare(b.name)
  })

  const navigateToFolder = useCallback((item: SharePointDriveItem) => {
    setFolderId(item.id)
    setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }])
    setSearchFilter("")
  }, [])

  const navigateToBreadcrumb = useCallback(
    (targetId: string | undefined) => {
      if (!targetId) {
        setFolderId(undefined)
        setBreadcrumbs([])
      } else {
        const idx = breadcrumbs.findIndex((s) => s.id === targetId)
        if (idx >= 0) {
          setFolderId(targetId)
          setBreadcrumbs((prev) => prev.slice(0, idx + 1))
        }
      }
    },
    [breadcrumbs],
  )

  const handleItemClick = (item: SharePointDriveItem) => {
    if (item.folder) {
      navigateToFolder(item)
    } else if (item.webUrl) {
      window.open(item.webUrl, "_blank")
    }
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col gap-4 overflow-y-auto p-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            router.push(`/sharepoint/${encodeURIComponent(siteId!)}`)
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {drive?.name ?? "Document Library"}
          </h1>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter files..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        <button
          onClick={() => navigateToBreadcrumb(undefined)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>{drive?.name ?? "Root"}</span>
        </button>
        {breadcrumbs.map((seg) => (
          <span key={seg.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => navigateToBreadcrumb(seg.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {seg.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Content */}
      {error ? (
        <ServiceError error={error} onRetry={refetch} />
      ) : loading ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 flex-1 max-w-[300px]" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Folder className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">
              {searchFilter.trim()
                ? "No files match your filter"
                : "This folder is empty"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchFilter.trim()
                ? "Try different filter terms"
                : "No items in this location"}
            </p>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50%]">Name</TableHead>
              <TableHead>Modified</TableHead>
              <TableHead>Modified By</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => {
              const { icon: Icon, color } = getFileIcon(item)
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleItemClick(item)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5 shrink-0", color)} />
                      <span className="truncate max-w-[300px]">
                        {item.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastModifiedDateTime
                      ? formatDistanceToNow(
                          new Date(item.lastModifiedDateTime),
                          { addSuffix: true },
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastModifiedBy?.user?.displayName || "-"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.folder
                      ? `${item.folder.childCount} items`
                      : formatFileSize(item.size) || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!item.folder && item["@microsoft.graph.downloadUrl"] && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(
                              item["@microsoft.graph.downloadUrl"],
                              "_blank",
                            )
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {siteId && driveId && (
                        <CollectButton
                          variant="icon-xs"
                          params={collectParamsForItem(siteId, driveId, item)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
