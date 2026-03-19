"use client"

import { useState, useCallback, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Upload,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

import { ObjectCard, getObjectConfig, getFolderConfig } from "@/components/buckets/object-card"
import { BucketBreadcrumbs } from "@/components/buckets/breadcrumbs"
import { BucketUploadDialog } from "@/components/buckets/upload-dialog"
import { ObjectPreview } from "@/components/buckets/object-preview"
import { formatFileSize } from "@/components/drive/file-card"
import {
  useObjects,
  useDownloadObject,
  type StorageObject,
} from "@/hooks/use-buckets"

type SortField = "name" | "updated" | "size"
type SortDirection = "asc" | "desc"

type ObjectBrowserProps = {
  bucket: string
  onBackToBuckets: () => void
}

export function ObjectBrowser({ bucket, onBackToBuckets }: ObjectBrowserProps) {
  const [view, setView] = useState<"grid" | "list">("list")

  useEffect(() => {
    const saved = localStorage.getItem("buckets-view") as "grid" | "list" | null
    if (saved === "grid" || saved === "list") {
      setView(saved)
    }
  }, [])
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDirection>("asc")
  const [prefix, setPrefix] = useState("")
  const [selectedObject, setSelectedObject] = useState<StorageObject | null>(null)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const { objects, prefixes, loading, refetch } = useObjects(bucket, prefix || undefined)
  const { download } = useDownloadObject()

  // Sort objects (prefixes first, then files)
  const sortedObjects = [...objects].sort((a, b) => {
    let cmp = 0
    const nameA = a.name?.split("/").pop() || a.name || ""
    const nameB = b.name?.split("/").pop() || b.name || ""
    if (sortField === "name") cmp = nameA.localeCompare(nameB)
    else if (sortField === "updated") cmp = (a.updated || "").localeCompare(b.updated || "")
    else if (sortField === "size") cmp = parseInt(a.size || "0") - parseInt(b.size || "0")
    return sortDir === "asc" ? cmp : -cmp
  })

  const setViewMode = (mode: "grid" | "list") => {
    setView(mode)
    localStorage.setItem("buckets-view", mode)
  }

  const navigateToPrefix = useCallback((newPrefix: string) => {
    setPrefix(newPrefix)
    setSelectedObject(null)
  }, [])

  const handleObjectClick = (obj: StorageObject) => {
    setSelectedObject(obj)
    if (showInfoPanel) setPreviewPath(obj.name)
  }

  const handleDownload = (obj: StorageObject) => {
    download(bucket, obj.name)
  }

  const handleInfoToggle = () => {
    setShowInfoPanel(!showInfoPanel)
    if (!showInfoPanel && selectedObject) {
      setPreviewPath(selectedObject.name)
    } else {
      setPreviewPath(null)
    }
  }

  return (
    <div className="flex h-full">
      <div
        className={cn("flex flex-1 flex-col gap-4 relative overflow-y-auto p-1")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/8 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold text-primary">Drop files to upload</p>
              <p className="text-sm text-primary/70">Files will be uploaded to the current prefix</p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 ml-auto">
            <BucketUploadDialog bucket={bucket} prefix={prefix} onComplete={refetch} />

            <Button variant="ghost" size="icon" aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"} onClick={() => setViewMode(view === "grid" ? "list" : "grid")}>
              {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Sort objects"><ArrowUpDown className="h-4 w-4" /></Button>} />
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setSortField("name"); setSortDir("asc") }}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("name"); setSortDir("desc") }}>
                  Name (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("updated"); setSortDir("desc") }}>
                  Last modified
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("size"); setSortDir("desc") }}>
                  Largest first
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" aria-label="Toggle details panel" onClick={handleInfoToggle}>
              <Info className={cn("h-4 w-4", showInfoPanel && "text-primary")} />
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <BucketBreadcrumbs
          bucket={bucket}
          prefix={prefix}
          onNavigateToBuckets={onBackToBuckets}
          onNavigateToPrefix={navigateToPrefix}
        />

        {/* Content */}
        {loading ? (
          <LoadingSkeleton view={view} />
        ) : prefixes.length === 0 && sortedObjects.length === 0 ? (
          <EmptyState />
        ) : view === "grid" ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {prefixes.map((p) => (
              <ObjectCard
                key={p}
                prefix={p}
                view="grid"
                onDoubleClick={() => navigateToPrefix(p)}
                onClick={() => setSelectedObject(null)}
              />
            ))}
            {sortedObjects.map((obj) => (
              <ObjectCard
                key={obj.name}
                object={obj}
                view="grid"
                selected={selectedObject?.name === obj.name}
                onClick={() => handleObjectClick(obj)}
                onDoubleClick={() => handleDownload(obj)}
                onDownload={() => handleDownload(obj)}
              />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50%]">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => { setSortField("name"); setSortDir(sortField === "name" && sortDir === "asc" ? "desc" : "asc") }}
                  >
                    Name
                    {sortField === "name" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => { setSortField("updated"); setSortDir(sortField === "updated" && sortDir === "desc" ? "asc" : "desc") }}
                  >
                    Modified
                    {sortField === "updated" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    className="inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                    onClick={() => { setSortField("size"); setSortDir(sortField === "size" && sortDir === "desc" ? "asc" : "desc") }}
                  >
                    Size
                    {sortField === "size" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prefixes.map((p) => {
                const folderConfig = getFolderConfig()
                const FolderIcon = folderConfig.icon
                const folderName = p.replace(/\/$/, "").split("/").pop() || p
                return (
                  <TableRow
                    key={p}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateToPrefix(p)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderIcon className={cn("h-5 w-5 shrink-0", folderConfig.color)} />
                        <span className="truncate max-w-[300px]">{folderName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">Folder</TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                  </TableRow>
                )
              })}
              {sortedObjects.map((obj) => {
                const config = getObjectConfig(obj.contentType)
                const Icon = config.icon
                const displayName = obj.name?.split("/").pop() || obj.name
                return (
                  <TableRow
                    key={obj.name}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedObject?.name === obj.name ? "bg-primary/8 hover:bg-primary/10" : "hover:bg-muted/50"
                    )}
                    onClick={() => handleObjectClick(obj)}
                    onDoubleClick={() => handleDownload(obj)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="truncate max-w-[300px] inline-block">{displayName}</span>
                          </TooltipTrigger>
                          <TooltipContent>{obj.name}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {config.label}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {obj.updated
                        ? formatDistanceToNow(new Date(obj.updated), { addSuffix: true })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatFileSize(obj.size) || "-"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {showInfoPanel && (
        <ObjectPreview
          bucket={bucket}
          path={previewPath}
          onClose={() => { setShowInfoPanel(false); setPreviewPath(null) }}
        />
      )}
    </div>
  )
}

function LoadingSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "grid") {
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 flex-1 max-w-[300px]" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Search className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium">No objects found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This prefix is empty. Upload files to get started.
        </p>
      </div>
    </div>
  )
}
