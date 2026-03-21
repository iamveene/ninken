"use client"

import { useState, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  LayoutGrid,
  List,
  Search,
  Upload,
  FolderPlus,
  Folder,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  File,
  Trash2,
  Loader2,
  ChevronRight,
  Home,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { CollectButton } from "@/components/collection/collect-button"
import type { CollectParams } from "@/hooks/use-collect-action"
import {
  useOneDriveFiles,
  useOneDriveSearch,
  useOneDriveUpload,
  useOneDriveCreateFolder,
  useDeleteOneDriveItem,
} from "@/hooks/use-onedrive"
import type { OneDriveItem } from "@/hooks/use-onedrive"

type BreadcrumbSegment = { id: string; name: string }

function getFileIcon(item: OneDriveItem) {
  if (item.folder) return { icon: Folder, color: "text-amber-500" }
  const mime = item.file?.mimeType || ""
  const ext = item.name.split(".").pop()?.toLowerCase() || ""
  if (mime.startsWith("image/")) return { icon: FileImage, color: "text-pink-500" }
  if (mime.startsWith("video/")) return { icon: FileVideo, color: "text-purple-500" }
  if (mime.startsWith("audio/")) return { icon: FileAudio, color: "text-green-500" }
  if (mime.includes("spreadsheet") || ext === "xlsx" || ext === "csv") return { icon: FileSpreadsheet, color: "text-emerald-500" }
  if (mime.includes("document") || mime.includes("pdf") || ext === "docx" || ext === "pdf") return { icon: FileText, color: "text-blue-500" }
  return { icon: File, color: "text-muted-foreground" }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function collectParamsForItem(item: OneDriveItem): CollectParams {
  if (item.folder) {
    return {
      type: "folder",
      source: "onedrive",
      title: item.name,
      subtitle: item.lastModifiedBy?.user?.displayName,
      sourceId: item.id,
      metadata: {
        childCount: item.folder.childCount,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
      },
    }
  }
  return {
    type: "file",
    source: "onedrive",
    title: item.name,
    subtitle: item.lastModifiedBy?.user?.displayName,
    sourceId: item.id,
    downloadUrl: `/api/microsoft/drive/files/${item.id}/download`,
    mimeType: item.file?.mimeType,
    sizeBytes: item.size,
    metadata: {
      mimeType: item.file?.mimeType,
      lastModifiedDateTime: item.lastModifiedDateTime,
      webUrl: item.webUrl,
    },
  }
}

export default function OneDrivePage() {
  const [view, setView] = useState<"grid" | "list">("list")
  const [folderId, setFolderId] = useState<string | undefined>()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const isSearching = !!searchTerm.trim()
  const { files, loading, error, refetch } = useOneDriveFiles(isSearching ? undefined : folderId)
  const { results: searchResults, loading: searchLoading } = useOneDriveSearch(searchTerm)
  const { upload, loading: uploadLoading } = useOneDriveUpload()
  const { createFolder, loading: createFolderLoading } = useOneDriveCreateFolder()
  const { deleteItem } = useDeleteOneDriveItem()

  const displayFiles = isSearching ? searchResults : files
  const isLoading = isSearching ? searchLoading : loading

  // Sort: folders first, then by name
  const sortedFiles = [...displayFiles].sort((a, b) => {
    if (a.folder && !b.folder) return -1
    if (!a.folder && b.folder) return 1
    return a.name.localeCompare(b.name)
  })

  const navigateToFolder = useCallback((item: OneDriveItem) => {
    setFolderId(item.id)
    setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }])
    setSearchTerm("")
  }, [])

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
  }, [breadcrumbs])

  const handleItemClick = (item: OneDriveItem) => {
    if (item.folder) {
      navigateToFolder(item)
    } else if (item.webUrl) {
      window.open(item.webUrl, "_blank")
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await upload(folderId, file)
      toast.success(`Uploaded "${file.name}"`)
      refetch()
    } catch {
      toast.error("Failed to upload")
    }
    e.target.value = ""
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolder(folderId, newFolderName.trim())
      toast.success(`Created folder "${newFolderName.trim()}"`)
      setNewFolderName("")
      setShowNewFolder(false)
      refetch()
    } catch {
      toast.error("Failed to create folder")
    }
  }

  const handleDelete = async (item: OneDriveItem) => {
    try {
      await deleteItem(item.id)
      toast.success(`"${item.name}" deleted`)
      refetch()
    } catch {
      toast.error("Failed to delete")
    }
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col gap-4 overflow-y-auto p-1">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search OneDrive..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 relative"
            disabled={uploadLoading}
            onClick={() => document.getElementById("onedrive-upload")?.click()}
          >
            <input id="onedrive-upload" type="file" className="hidden" onChange={handleUpload} disabled={uploadLoading} />
            {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNewFolder(true)}>
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {!isSearching && (
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateToBreadcrumb(undefined)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>OneDrive</span>
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
      )}

      {/* File content */}
      {isLoading ? (
        view === "grid" ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
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
        )
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <File className="h-10 w-10 text-destructive/50" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : sortedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className={cn("flex h-20 w-20 items-center justify-center rounded-full", isSearching ? "bg-muted" : "bg-amber-50 dark:bg-amber-950/30")}>
            {isSearching ? (
              <Search className="h-10 w-10 text-muted-foreground" />
            ) : (
              <FolderPlus className="h-10 w-10 text-amber-500 dark:text-amber-400" />
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{isSearching ? "No files match your search" : "This folder is empty"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{isSearching ? "Try different search terms" : "Upload files or create a folder to get started"}</p>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {sortedFiles.map((item) => {
            const { icon: Icon, color } = getFileIcon(item)
            return (
              <button
                key={item.id}
                className="flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left group"
                onClick={() => handleItemClick(item)}
              >
                <div className="relative">
                  <Icon className={cn("h-10 w-10", color)} />
                  <div className="absolute -top-2 -right-4 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CollectButton
                      variant="icon-xs"
                      params={collectParamsForItem(item)}
                    />
                    <button
                      className="p-0.5 rounded hover:bg-destructive/20"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
                <span className="text-sm font-medium truncate w-full text-center">{item.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {item.folder ? `${item.folder.childCount} items` : formatFileSize(item.size)}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50%]">Name</TableHead>
              <TableHead>Modified</TableHead>
              <TableHead>Modified By</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFiles.map((item) => {
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
                      <span className="truncate max-w-[300px]">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastModifiedDateTime
                      ? formatDistanceToNow(new Date(item.lastModifiedDateTime), { addSuffix: true })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastModifiedBy?.user?.displayName || "-"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.folder ? `${item.folder.childCount} items` : formatFileSize(item.size) || "-"}
                  </TableCell>
                  <TableCell>
                    <CollectButton
                      variant="icon-xs"
                      params={collectParamsForItem(item)}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={createFolderLoading || !newFolderName.trim()}>
                {createFolderLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
