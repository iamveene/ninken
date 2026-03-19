export type CollectionItemType = "email" | "file" | "object" | "chat-message"
export type CollectionItemStatus = "pending" | "downloading" | "done" | "error"
export type CollectionSource = "gmail" | "drive" | "gcs" | "outlook" | "onedrive" | "teams"

export type CollectionItem = {
  id: string
  type: CollectionItemType
  source: CollectionSource
  status: CollectionItemStatus
  title: string
  subtitle?: string
  sourceId: string
  downloadUrl?: string
  mimeType?: string
  sizeBytes?: number
  collectedAt: number
  completedAt?: number
  error?: string
  retries: number
  metadata?: Record<string, unknown>
}

export type CollectionBlob = {
  id: string // matches CollectionItem.id
  data: ArrayBuffer
  mimeType: string
  filename: string
}

export type CollectionStats = {
  total: number
  pending: number
  downloading: number
  done: number
  error: number
  totalBytes: number
}

const DB_NAME = "ninken-collection"
const DB_VERSION = 1
const ITEMS_STORE = "items"
const BLOBS_STORE = "blobs"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        const store = db.createObjectStore(ITEMS_STORE, { keyPath: "id" })
        store.createIndex("status", "status", { unique: false })
        store.createIndex("source", "source", { unique: false })
        store.createIndex("type", "type", { unique: false })
        store.createIndex("collectedAt", "collectedAt", { unique: false })
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ---------- Items ----------

export async function addItem(
  item: Omit<CollectionItem, "id" | "collectedAt" | "retries" | "status">
): Promise<CollectionItem> {
  const db = await openDB()
  const newItem: CollectionItem = {
    ...item,
    id: crypto.randomUUID(),
    status: "pending",
    collectedAt: Date.now(),
    retries: 0,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ITEMS_STORE, "readwrite")
    tx.objectStore(ITEMS_STORE).put(newItem)
    tx.oncomplete = () => resolve(newItem)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getItem(id: string): Promise<CollectionItem | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ITEMS_STORE, "readonly")
    const req = tx.objectStore(ITEMS_STORE).get(id)
    req.onsuccess = () => resolve(req.result as CollectionItem | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllItems(options?: {
  status?: CollectionItemStatus
  source?: CollectionSource
  type?: CollectionItemType
  limit?: number
}): Promise<CollectionItem[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ITEMS_STORE, "readonly")
    const store = tx.objectStore(ITEMS_STORE)
    const req = store.getAll()

    req.onsuccess = () => {
      let results = (req.result as CollectionItem[]).sort(
        (a, b) => b.collectedAt - a.collectedAt
      )

      if (options?.status) {
        results = results.filter((i) => i.status === options.status)
      }
      if (options?.source) {
        results = results.filter((i) => i.source === options.source)
      }
      if (options?.type) {
        results = results.filter((i) => i.type === options.type)
      }
      if (options?.limit) {
        results = results.slice(0, options.limit)
      }

      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function updateItem(
  id: string,
  updates: Partial<Pick<CollectionItem, "status" | "completedAt" | "error" | "retries" | "sizeBytes">>
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ITEMS_STORE, "readwrite")
    const store = tx.objectStore(ITEMS_STORE)
    const req = store.get(id)
    req.onsuccess = () => {
      const item = req.result as CollectionItem | undefined
      if (item) {
        Object.assign(item, updates)
        store.put(item)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function removeItem(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ITEMS_STORE, BLOBS_STORE], "readwrite")
    tx.objectStore(ITEMS_STORE).delete(id)
    tx.objectStore(BLOBS_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearCollection(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ITEMS_STORE, BLOBS_STORE], "readwrite")
    tx.objectStore(ITEMS_STORE).clear()
    tx.objectStore(BLOBS_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------- Blobs ----------

export async function saveBlob(blob: CollectionBlob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, "readwrite")
    tx.objectStore(BLOBS_STORE).put(blob)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getBlob(id: string): Promise<CollectionBlob | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, "readonly")
    const req = tx.objectStore(BLOBS_STORE).get(id)
    req.onsuccess = () => resolve(req.result as CollectionBlob | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function removeBlob(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, "readwrite")
    tx.objectStore(BLOBS_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------- Stats ----------

export async function getStats(): Promise<CollectionStats> {
  const items = await getAllItems()
  return {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    downloading: items.filter((i) => i.status === "downloading").length,
    done: items.filter((i) => i.status === "done").length,
    error: items.filter((i) => i.status === "error").length,
    totalBytes: items
      .filter((i) => i.status === "done")
      .reduce((sum, i) => sum + (i.sizeBytes ?? 0), 0),
  }
}

// ---------- Duplicate check ----------

export async function itemExists(sourceId: string, source: CollectionSource): Promise<boolean> {
  const items = await getAllItems({ source })
  return items.some((i) => i.sourceId === sourceId)
}
