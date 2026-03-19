"use client"

import { useState, useCallback } from "react"
import {
  Play,
  Square,
  Trash2,
  RotateCcw,
  Download,
  Filter,
} from "lucide-react"
import { toast } from "sonner"
import JSZip from "jszip"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCollection } from "@/hooks/use-collection"
import { CollectionStats } from "@/components/collection/collection-stats"
import { CollectionList } from "@/components/collection/collection-list"
import { QueueIndicator } from "@/components/collection/queue-indicator"
import { getBlob } from "@/lib/collection-store"
import type {
  CollectionItemStatus,
  CollectionSource,
} from "@/lib/collection-store"

export default function CollectionPage() {
  const [statusFilter, setStatusFilter] = useState<CollectionItemStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<CollectionSource | "all">("all")
  const [exporting, setExporting] = useState(false)

  const {
    items,
    stats,
    loading,
    removeItem,
    clearAll,
    retryItem,
    retryAllErrors,
    startQueue,
    stopQueue,
  } = useCollection({
    status: statusFilter === "all" ? undefined : statusFilter,
    source: sourceFilter === "all" ? undefined : sourceFilter,
  })

  const handleExportZip = useCallback(async () => {
    setExporting(true)
    try {
      const zip = new JSZip()
      const doneItems = items.filter((i) => i.status === "done")

      if (doneItems.length === 0) {
        toast.info("No completed items to export")
        return
      }

      let added = 0
      for (const item of doneItems) {
        const blob = await getBlob(item.id)
        if (blob) {
          // Organize by source folder
          const folder = zip.folder(item.source) ?? zip
          folder.file(blob.filename, blob.data)
          added++
        }
      }

      if (added === 0) {
        toast.info("No blob data found for completed items")
        return
      }

      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `ninken-collection-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${added} items to ZIP`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed"
      toast.error("Export failed", { description: msg })
    } finally {
      setExporting(false)
    }
  }, [items])

  const handleClearAll = useCallback(async () => {
    if (!confirm("Remove all items from the collection? This cannot be undone.")) return
    await clearAll()
    toast.success("Collection cleared")
  }, [clearAll])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Collected evidence from across services. Download queue processes items one at a time.
          </p>
        </div>
        <QueueIndicator stats={stats} />
      </div>

      <CollectionStats stats={stats} />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={startQueue}
          disabled={stats.pending === 0}
        >
          <Play className="size-3.5" />
          Start Queue
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={stopQueue}
        >
          <Square className="size-3.5" />
          Stop
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={retryAllErrors}
          disabled={stats.error === 0}
        >
          <RotateCcw className="size-3.5" />
          Retry Errors
        </Button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CollectionItemStatus | "all")}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="downloading">Downloading</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as CollectionSource | "all")}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="gmail">Gmail</SelectItem>
              <SelectItem value="drive">Drive</SelectItem>
              <SelectItem value="gcs">GCS</SelectItem>
              <SelectItem value="outlook">Outlook</SelectItem>
              <SelectItem value="onedrive">OneDrive</SelectItem>
              <SelectItem value="teams">Teams</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleExportZip}
          disabled={exporting || stats.done === 0}
        >
          <Download className="size-3.5" />
          {exporting ? "Exporting..." : "Export ZIP"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          onClick={handleClearAll}
          disabled={stats.total === 0}
        >
          <Trash2 className="size-3.5" />
          Clear All
        </Button>
      </div>

      {/* Items list */}
      <CollectionList
        items={items}
        loading={loading}
        onRemove={removeItem}
        onRetry={retryItem}
      />
    </div>
  )
}
