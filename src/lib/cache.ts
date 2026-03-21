"use client"

export const CACHE_TTL_LIST = 5 * 60 * 1000
export const CACHE_TTL_BODY = 30 * 60 * 1000
export const CACHE_TTL_DOWNLOAD = 60 * 60 * 1000
export const CACHE_TTL_PROFILE = 60 * 60 * 1000

const DB_NAME = "ninken-cache"
const STORE_NAME = "cache"
const MAX_SIZE = 50 * 1024 * 1024
const TARGET_SIZE = 40 * 1024 * 1024

type CacheEntry<T = unknown> = {
  key: string
  data: T
  expiresAt: number
  accessedAt: number
  size: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheGet<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      const entry = req.result as CacheEntry<T> | undefined
      if (!entry) {
        resolve(null)
        return
      }
      entry.accessedAt = Date.now()
      store.put(entry)
      resolve({ data: entry.data, stale: Date.now() > entry.expiresAt })
    }
    req.onerror = () => reject(req.error)
  })
}

export async function cacheSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const db = await openDB()
  const json = JSON.stringify(data)
  const size = new Blob([json]).size
  const entry: CacheEntry<T> = {
    key,
    data,
    expiresAt: Date.now() + ttlMs,
    accessedAt: Date.now(),
    size,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  await evictIfNeeded()
}

async function evictIfNeeded(): Promise<void> {
  const db = await openDB()
  const entries = await new Promise<CacheEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
  if (totalSize <= MAX_SIZE) return

  entries.sort((a, b) => a.accessedAt - b.accessedAt)
  let currentSize = totalSize
  const keysToDelete: string[] = []

  for (const entry of entries) {
    if (currentSize <= TARGET_SIZE) break
    keysToDelete.push(entry.key)
    currentSize -= entry.size
  }

  if (keysToDelete.length === 0) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    for (const key of keysToDelete) {
      store.delete(key)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function cacheClear(): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCacheSize(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const entries = req.result as CacheEntry[]
      resolve(entries.reduce((sum, e) => sum + e.size, 0))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function cacheDelete(key: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
