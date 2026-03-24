"use client"

import type { LLMProviderId } from "./llm/types"

// ---------- Types ----------

export type AISettings = {
  provider: LLMProviderId
  model: string
  apiKey: string
  /** Endpoint URL — used only for Ollama */
  endpoint?: string
  /** Custom model override — used only for Ollama */
  customModel?: string
}

export type AppSettings = {
  ai: AISettings
}

const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: "",
  },
}

// ---------- IndexedDB ----------

const DB_NAME = "ninken-settings"
const DB_VERSION = 1
const STORE_NAME = "settings"
const SETTINGS_KEY = "app"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbGet<T>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------- Public API ----------

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await openDB()
    const row = await idbGet<{ id: string; data: AppSettings }>(db, SETTINGS_KEY)
    db.close()
    return row?.data ?? { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDB()
  await idbPut(db, { id: SETTINGS_KEY, data: settings })
  db.close()
}
