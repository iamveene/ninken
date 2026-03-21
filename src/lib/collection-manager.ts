import {
  getItem,
  getAllItems,
  updateItem,
  saveBlob,
  type CollectionItem,
  type CollectionBlob,
} from "./collection-store"

export type CollectionManagerEvent =
  | { type: "item-started"; item: CollectionItem }
  | { type: "item-completed"; item: CollectionItem }
  | { type: "item-error"; item: CollectionItem; error: string }
  | { type: "queue-empty" }
  | { type: "queue-changed" }

type Listener = (event: CollectionManagerEvent) => void

const MAX_RETRIES = 3
const DELAY_MS = 2000
const CONCURRENT = 1

class CollectionManager {
  private static instance: CollectionManager | null = null
  private processing = false
  private listeners = new Set<Listener>()
  private activeCount = 0

  static getInstance(): CollectionManager {
    if (!CollectionManager.instance) {
      CollectionManager.instance = new CollectionManager()
    }
    return CollectionManager.instance
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: CollectionManagerEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // listener error, ignore
      }
    }
  }

  get isProcessing(): boolean {
    return this.processing
  }

  get currentActiveCount(): number {
    return this.activeCount
  }

  async startProcessing(): Promise<void> {
    if (this.processing) return
    this.processing = true
    this.emit({ type: "queue-changed" })

    try {
      await this.processLoop()
    } finally {
      this.processing = false
      this.emit({ type: "queue-empty" })
    }
  }

  stopProcessing(): void {
    this.processing = false
  }

  private async processLoop(): Promise<void> {
    while (this.processing) {
      const pendingItems = await getAllItems({ status: "pending" })
      if (pendingItems.length === 0) {
        break
      }

      const batch = pendingItems.slice(0, CONCURRENT)
      for (const item of batch) {
        if (!this.processing) break
        await this.processItem(item)
        if (this.processing) {
          await this.delay(DELAY_MS)
        }
      }
    }
  }

  private async processItem(item: CollectionItem): Promise<void> {
    this.activeCount++
    try {
      // Mark as downloading
      await updateItem(item.id, { status: "downloading" })
      const updatedItem = await getItem(item.id)
      if (updatedItem) {
        this.emit({ type: "item-started", item: updatedItem })
        this.emit({ type: "queue-changed" })
      }

      // Download the content
      const result = await this.download(item)

      // Save blob
      const blob: CollectionBlob = {
        id: item.id,
        data: result.data,
        mimeType: result.mimeType,
        filename: result.filename,
      }
      await saveBlob(blob)

      // Mark as done
      await updateItem(item.id, {
        status: "done",
        completedAt: Date.now(),
        sizeBytes: result.data.byteLength,
      })
      const completedItem = await getItem(item.id)
      if (completedItem) {
        this.emit({ type: "item-completed", item: completedItem })
        this.emit({ type: "queue-changed" })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Download failed"
      const newRetries = item.retries + 1

      if (newRetries < MAX_RETRIES) {
        // Retry later
        await updateItem(item.id, {
          status: "pending",
          retries: newRetries,
          error: errorMessage,
        })
      } else {
        // Max retries exceeded
        await updateItem(item.id, {
          status: "error",
          retries: newRetries,
          error: errorMessage,
        })
      }

      const errorItem = await getItem(item.id)
      if (errorItem) {
        this.emit({ type: "item-error", item: errorItem, error: errorMessage })
        this.emit({ type: "queue-changed" })
      }
    } finally {
      this.activeCount--
    }
  }

  private async download(
    item: CollectionItem
  ): Promise<{ data: ArrayBuffer; mimeType: string; filename: string }> {
    if (!item.downloadUrl) {
      throw new Error("No download URL available")
    }

    const res = await fetch(item.downloadUrl)
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    }

    const data = await res.arrayBuffer()
    const contentType = res.headers.get("content-type") || item.mimeType || "application/octet-stream"

    // Derive filename from item title + mime
    const filename = this.deriveFilename(item)

    return { data, mimeType: contentType, filename }
  }

  private deriveFilename(item: CollectionItem): string {
    const base = item.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)

    switch (item.type) {
      case "email":
        return `${base}.eml`
      case "chat-message":
        return `${base}.txt`
      case "project":
        // Repo archives are tar.gz
        if (item.mimeType === "application/gzip") return `${base}.tar.gz`
        return `${base}.tar.gz`
      case "file":
      case "object":
        // Try to extract extension from the original title
        if (item.title.includes(".")) return base
        if (item.mimeType) {
          const ext = mimeToExtension(item.mimeType)
          if (ext) return `${base}.${ext}`
        }
        return base
      default:
        return base
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** Retry a single errored item */
  async retryItem(id: string): Promise<void> {
    await updateItem(id, { status: "pending", retries: 0, error: undefined })
    this.emit({ type: "queue-changed" })
    if (!this.processing) {
      this.startProcessing()
    }
  }
}

function mimeToExtension(mime: string): string | null {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/html": "html",
    "text/csv": "csv",
    "application/json": "json",
    "application/xml": "xml",
    "application/zip": "zip",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  }
  return map[mime] ?? null
}

export function getCollectionManager(): CollectionManager {
  return CollectionManager.getInstance()
}
