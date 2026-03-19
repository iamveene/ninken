"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, FileUp, X, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useUploadObject } from "@/hooks/use-buckets"
import { toast } from "sonner"

type UploadItem = {
  file: File
  progress: number
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

type UploadDialogProps = {
  bucket: string
  prefix?: string
  onComplete?: () => void
  children?: React.ReactNode
}

export function BucketUploadDialog({ bucket, prefix, onComplete, children }: UploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload } = useUploadObject()

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const handleUploadAll = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== "pending") continue

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading" as const } : item
        )
      )

      const result = await upload(items[i].file, bucket, prefix)

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i
            ? {
                ...item,
                progress: 100,
                status: result ? ("done" as const) : ("error" as const),
                error: result ? undefined : "Upload failed",
              }
            : item
        )
      )
    }

    toast.success("Upload complete")
    onComplete?.()
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const pendingCount = items.filter((i) => i.status === "pending").length

  return (
    <Dialog open={open} onOpenChange={(open) => { setOpen(open); if (!open) setItems([]) }}>
      <DialogTrigger
        render={
          children ? (
            <>{children}</>
          ) : (
            <Button variant="default" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Drag and drop files or click to browse
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <FileUp className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium">Drop files here</p>
          <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(item.file.size / 1024).toFixed(1)} KB
                  </p>
                  {item.status === "uploading" && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {item.status === "done" ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                ) : item.status === "error" ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-red-500">{item.error}</span>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                ) : item.status === "pending" ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={(e) => { e.stopPropagation(); removeItem(idx) }}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleUploadAll}
            disabled={pendingCount === 0}
          >
            Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
