"use client"

const DB_NAME = "ninken-offline-queue"
const STORE_NAME = "actions"

export type QueuedAction = {
  id: number
  type: string
  payload: unknown
  createdAt: number
  retries: number
}

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function enqueueAction(type: string, payload: unknown): Promise<void> {
  const db = await openQueueDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.add({ type, payload, createdAt: Date.now(), retries: 0 })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function removeAction(id: number): Promise<void> {
  const db = await openQueueDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueueSize(): Promise<number> {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function processQueue(
  handlers: Record<string, (payload: unknown) => Promise<void>>
): Promise<void> {
  const actions = await getQueuedActions()
  for (const action of actions) {
    const handler = handlers[action.type]
    if (!handler) continue
    try {
      await handler(action.payload)
      await removeAction(action.id)
    } catch {
      if (action.retries >= 2) {
        await removeAction(action.id)
      } else {
        const db = await openQueueDB()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite")
          const store = tx.objectStore(STORE_NAME)
          store.put({ ...action, retries: action.retries + 1 })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      }
    }
  }
}
