/**
 * IndexedDB store for user-defined secret detection patterns.
 * Patterns persist across sessions and integrate with the built-in pattern library.
 */

import type { SecretCategory, SecretSeverity } from "./secret-patterns"

// ── Types ──────────────────────────────────────────────────────

export type CustomPattern = {
  id: string
  name: string
  /** The regex source string (not a RegExp — stored as string for IndexedDB) */
  regexSource: string
  regexFlags: string
  severity: SecretSeverity
  category: SecretCategory
  description: string
  /** Query string to search service APIs */
  searchQuery: string
  createdAt: number
  updatedAt: number
}

// ── DB Setup ───────────────────────────────────────────────────

const DB_NAME = "ninken-custom-patterns"
const DB_VERSION = 1
const STORE_NAME = "patterns"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── CRUD Operations ────────────────────────────────────────────

export async function getAllCustomPatterns(): Promise<CustomPattern[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as CustomPattern[])
    req.onerror = () => reject(req.error)
  })
}

export async function addCustomPattern(
  pattern: Omit<CustomPattern, "id" | "createdAt" | "updatedAt">
): Promise<CustomPattern> {
  const db = await openDB()
  const now = Date.now()
  const full: CustomPattern = {
    ...pattern,
    id: `custom-${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const req = tx.objectStore(STORE_NAME).put(full)
    req.onsuccess = () => resolve(full)
    req.onerror = () => reject(req.error)
  })
}

export async function updateCustomPattern(
  id: string,
  updates: Partial<Omit<CustomPattern, "id" | "createdAt">>
): Promise<void> {
  const db = await openDB()
  const existing = await new Promise<CustomPattern | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result as CustomPattern | undefined)
    req.onerror = () => reject(req.error)
  })
  if (!existing) return
  const updated = { ...existing, ...updates, updatedAt: Date.now() }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const req = tx.objectStore(STORE_NAME).put(updated)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function removeCustomPattern(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Convert a CustomPattern into the same shape as a built-in SecretPattern.
 */
export function toSecretPattern(cp: CustomPattern) {
  return {
    id: cp.id,
    name: cp.name,
    regex: new RegExp(cp.regexSource, cp.regexFlags),
    severity: cp.severity,
    category: cp.category,
    description: cp.description,
    searchQuery: cp.searchQuery,
    isCustom: true as const,
  }
}
