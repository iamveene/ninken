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
  FolderPlus,
  Upload,
  FileUp,
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
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

import { Panel, Group as PanelGroup } from "react-resizable-panels"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { FileCard, getFileConfig, formatFileSize } from "@/components/drive/file-card"
import { FileContextMenu } from "@/components/drive/context-menu"
import { DriveBreadcrumbs, type BreadcrumbSegment } from "@/components/drive/breadcrumbs"
import { DriveSearchBar } from "@/components/drive/search-bar"
import { SearchFilters } from "@/components/drive/search-filters"
import { UploadDialog } from "@/components/drive/upload-dialog"
import { ShareDialog } from "@/components/drive/share-dialog"
import { RenameDialog } from "@/components/drive/rename-dialog"
import { FilePreview } from "@/components/drive/file-preview"
import {
  useFiles,
  useSearchFiles,
  useSharedDrives,
  useCopyFile,
  useTrashFile,
  useDeleteFile,
  type DriveFile,
  type SharedDrive,
  type SortField,
  type SortDirection,
} from "@/hooks/use-drive"
import { Users, HardDrive } from "lucide-react"

export function FileBrowser() {
  const [view, setView] = useState<"grid" | "list">("list")

  useEffect(() => {
    const saved = localStorage.getItem("drive-view") as "grid" | "list" | null
    if (saved === "grid" || saved === "list") {
      setView(saved)
    }
  }, [])
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDirection>("asc")
  const [folderId, setFolderId] = useState<string | undefined>()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([])
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)

  // Shared drives state
  const [activeTab, setActiveTab] = useState<"my" | "shared">("my")
  const [activeDrive, setActiveDrive] = useState<SharedDrive | null>(null)

  // Search state
  const [searchTerm, setSearchTerm] = useState("")
  const [searchType, setSearchType] = useState("")
  const [sharedWithMe, setSharedWithMe] = useState(false)
  const [starred, setStarred] = useState(false)

  // Dialog state
  const [shareFile, setShareFile] = useState<DriveFile | null>(null)
  const [renameFile, setRenameFile] = useState<DriveFile | null>(null)
  const [deleteFile, setDeleteFile] = useState<DriveFile | null>(null)

  // Drag overlay
  const [dragOver, setDragOver] = useState(false)

  const isSearching = !!searchTerm.trim()
  const { drives: sharedDrives, loading: sharedDrivesLoading } = useSharedDrives()
  const { files, loading, refetch } = useFiles(
    isSearching ? undefined : folderId,
    undefined,
    50,
    activeDrive?.id
  )
  const { results: searchResults, loading: searchLoading } = useSearchFiles(searchTerm, searchType || undefined)
  const { copy } = useCopyFile()
  const { trash } = useTrashFile()
  const { deleteFile: permanentDelete } = useDeleteFile()

  const displayFiles = isSearching ? searchResults : files

  // Sort files
  const sortedFiles = [...displayFiles].sort((a, b) => {
    // Folders first
    const aIsFolder = a.mimeType === "application/vnd.google-apps.folder"
    const bIsFolder = b.mimeType === "application/vnd.google-apps.folder"
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1

    let cmp = 0
    if (sortField === "name") cmp = a.name.localeCompare(b.name)
    else if (sortField === "modifiedTime") cmp = (a.modifiedTime || "").localeCompare(b.modifiedTime || "")
    else if (sortField === "size") cmp = parseInt(a.size || "0") - parseInt(b.size || "0")
    return sortDir === "asc" ? cmp : -cmp
  })

  const setViewMode = (mode: "grid" | "list") => {
    setView(mode)
    localStorage.setItem("drive-view", mode)
  }

  const navigateToFolder = useCallback(
    (file: DriveFile) => {
      setFolderId(file.id)
      setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }])
      setSelectedFile(null)
    },
    []
  )

  const navigateToBreadcrumb = useCallback((targetId: string | undefined) => {
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
    setSelectedFile(null)
  }, [breadcrumbs])

  const handleTabChange = useCallback((tab: "my" | "shared") => {
    setActiveTab(tab)
    setActiveDrive(null)
    setFolderId(undefined)
    setBreadcrumbs([])
    setSelectedFile(null)
    setSearchTerm("")
    setSearchType("")
  }, [])

  const handleEnterSharedDrive = useCallback((drive: SharedDrive) => {
    setActiveDrive(drive)
    setFolderId(undefined)
    setBreadcrumbs([])
    setSelectedFile(null)
  }, [])

  const handleFileClick = (file: DriveFile) => {
    setSelectedFile(file)
    if (showInfoPanel) setPreviewFileId(file.id)
  }

  const handleFileDoubleClick = (file: DriveFile) => {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      navigateToFolder(file)
    } else if (file.webViewLink) {
      window.open(file.webViewLink, "_blank")
    }
  }

  const handleDownload = (file: DriveFile) => {
    window.open(`/api/drive/files/${file.id}/download`, "_blank")
  }

  const handleCopy = async (file: DriveFile) => {
    try {
      await copy(file.id)
      toast.success(`Copied "${file.name}"`)
      refetch()
    } catch {
      toast.error("Failed to copy")
    }
  }

  const handleTrash = async (file: DriveFile) => {
    try {
      await trash(file.id)
      toast.success(`"${file.name}" moved to trash`)
      refetch()
    } catch {
      toast.error("Failed to trash")
    }
  }

  const handleDelete = async () => {
    if (!deleteFile) return
    try {
      await permanentDelete(deleteFile.id)
      toast.success(`"${deleteFile.name}" deleted permanently`)
      setDeleteFile(null)
      refetch()
    } catch {
      toast.error("Failed to delete")
    }
  }

  const handleInfoToggle = () => {
    setShowInfoPanel(!showInfoPanel)
    if (!showInfoPanel && selectedFile) {
      setPreviewFileId(selectedFile.id)
    } else {
      setPreviewFileId(null)
    }
  }

  const isLoading = isSearching ? searchLoading : loading

  return (
    <PanelGroup orientation="horizontal" id="drive-panels">
      <Panel defaultSize={showInfoPanel ? 70 : 100} minSize={40}>
      <div
        className={cn("flex flex-1 flex-col gap-4 relative overflow-y-auto p-1 h-full")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/8 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold text-primary">Drop files to upload</p>
              <p className="text-sm text-primary/70">Files will be uploaded to the current folder</p>
            </div>
          </div>
        )}

        {/* Drive tabs */}
        <div className="flex items-center gap-1 border-b pb-2">
          <button
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === "my"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => handleTabChange("my")}
          >
            My Drive
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === "shared"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => handleTabChange("shared")}
          >
            Shared Drives
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <DriveSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={() => { setSearchTerm(""); setSearchType("") }}
          />

          <div className="flex items-center gap-1 ml-auto">
            <UploadDialog folderId={folderId} onComplete={refetch} />

            <Button variant="ghost" size="icon" aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"} onClick={() => setViewMode(view === "grid" ? "list" : "grid")}>
              {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Sort files"><ArrowUpDown className="h-4 w-4" /></Button>} />
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setSortField("name"); setSortDir("asc") }}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("name"); setSortDir("desc") }}>
                  Name (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("modifiedTime"); setSortDir("desc") }}>
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

        {/* Search filters */}
        {isSearching && (
          <SearchFilters
            activeType={searchType}
            onTypeChange={setSearchType}
            sharedWithMe={sharedWithMe}
            onSharedToggle={() => setSharedWithMe(!sharedWithMe)}
            starred={starred}
            onStarredToggle={() => setStarred(!starred)}
          />
        )}

        {/* Breadcrumbs */}
        {!isSearching && (activeTab === "my" || activeDrive) && (
          <DriveBreadcrumbs
            path={breadcrumbs}
            onNavigate={navigateToBreadcrumb}
            rootLabel={activeDrive ? activeDrive.name : "My Drive"}
          />
        )}

        {/* Shared drives list */}
        {activeTab === "shared" && !activeDrive && !isSearching ? (
          sharedDrivesLoading ? (
            <LoadingSkeleton view={view} />
          ) : sharedDrives.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <HardDrive className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">No shared drives</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You don't have access to any shared drives
                </p>
              </div>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {sharedDrives.map((drive) => (
                <button
                  key={drive.id}
                  className="flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                  onDoubleClick={() => handleEnterSharedDrive(drive)}
                  onClick={() => handleEnterSharedDrive(drive)}
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl"
                    style={{ backgroundColor: drive.colorRgb ? `${drive.colorRgb}20` : undefined }}
                  >
                    <HardDrive
                      className="h-8 w-8"
                      style={{ color: drive.colorRgb || undefined }}
                    />
                  </div>
                  <span className="text-sm font-medium truncate w-full text-center">{drive.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedDrives.map((drive) => (
                  <TableRow
                    key={drive.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEnterSharedDrive(drive)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HardDrive
                          className="h-5 w-5 shrink-0"
                          style={{ color: drive.colorRgb || undefined }}
                        />
                        <span>{drive.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {drive.createdTime
                        ? formatDistanceToNow(new Date(drive.createdTime), { addSuffix: true })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : null}

        {/* File content */}
        {(activeTab === "my" || activeDrive || isSearching) && (isLoading ? (
          <LoadingSkeleton view={view} />
        ) : sortedFiles.length === 0 ? (
          <EmptyState isSearching={isSearching} />
        ) : view === "grid" ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {sortedFiles.map((file) => (
              <FileContextMenu
                key={file.id}
                file={file}
                onOpen={() => handleFileDoubleClick(file)}
                onDownload={file.mimeType !== "application/vnd.google-apps.folder" ? () => handleDownload(file) : undefined}
                onRename={() => setRenameFile(file)}
                onCopy={() => handleCopy(file)}
                onShare={() => setShareFile(file)}
                onTrash={() => handleTrash(file)}
                onDelete={() => setDeleteFile(file)}
              >
                <FileCard
                  file={file}
                  view="grid"
                  selected={selectedFile?.id === file.id}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                  onDownload={() => handleDownload(file)}
                  onShare={() => setShareFile(file)}
                />
              </FileContextMenu>
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
                <TableHead>Owner</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => { setSortField("modifiedTime"); setSortDir(sortField === "modifiedTime" && sortDir === "desc" ? "asc" : "desc") }}
                  >
                    Modified
                    {sortField === "modifiedTime" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
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
              {sortedFiles.map((file) => {
                const config = getFileConfig(file.mimeType)
                const Icon = config.icon
                return (
                  <FileContextMenu
                    key={file.id}
                    file={file}
                    triggerRender={
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedFile?.id === file.id ? "bg-primary/8 hover:bg-primary/10" : "hover:bg-muted/50"
                        )}
                        onClick={() => handleFileClick(file)}
                        onDoubleClick={() => handleFileDoubleClick(file)}
                      />
                    }
                    onOpen={() => handleFileDoubleClick(file)}
                    onDownload={file.mimeType !== "application/vnd.google-apps.folder" ? () => handleDownload(file) : undefined}
                    onRename={() => setRenameFile(file)}
                    onCopy={() => handleCopy(file)}
                    onShare={() => setShareFile(file)}
                    onTrash={() => handleTrash(file)}
                    onDelete={() => setDeleteFile(file)}
                  >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="truncate max-w-[300px] inline-block">{file.name}</span>
                            </TooltipTrigger>
                            <TooltipContent>{file.name}</TooltipContent>
                          </Tooltip>
                          {file.shared && (
                            <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
                              <Users className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {file.owners?.[0]?.displayName || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {file.modifiedTime
                          ? formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatFileSize(file.size) || "-"}
                      </TableCell>
                  </FileContextMenu>
                )
              })}
            </TableBody>
          </Table>
        ))}
      </div>

      </Panel>
      {/* Info panel */}
      {showInfoPanel && (
        <>
          <ResizeHandle />
          <Panel defaultSize={30} minSize={20} maxSize={50}>
            <FilePreview
              fileId={previewFileId}
              onClose={() => { setShowInfoPanel(false); setPreviewFileId(null) }}
            />
          </Panel>
        </>
      )}

      {/* Dialogs */}
      <ShareDialog
        file={shareFile}
        open={!!shareFile}
        onOpenChange={(open) => !open && setShareFile(null)}
      />

      <RenameDialog
        file={renameFile}
        open={!!renameFile}
        onOpenChange={(open) => !open && setRenameFile(null)}
        onRenamed={refetch}
      />

      <AlertDialog open={!!deleteFile} onOpenChange={(open) => !open && setDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteFile?.name}" will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelGroup>
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

function EmptyState({ isSearching }: { isSearching: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <div className={cn(
        "flex h-20 w-20 items-center justify-center rounded-full",
        isSearching ? "bg-muted" : "bg-amber-50 dark:bg-amber-950/30"
      )}>
        {isSearching ? (
          <Search className="h-10 w-10 text-muted-foreground" />
        ) : (
          <FolderPlus className="h-10 w-10 text-amber-500 dark:text-amber-400" />
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-medium">
          {isSearching ? "No files match your search" : "This folder is empty"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSearching
            ? "Try different search terms or filters"
            : "Upload files or create a folder to get started"}
        </p>
      </div>
    </div>
  )
}
