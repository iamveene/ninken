"use client"

import type { VaultItem, VaultStats } from "./vault/types"

const DB_NAME = "ninken-vault"
const DB_VERSION = 1
const VAULT_STORE = "vault-items"
const CRYPTO_STORE = "crypto"
const CRYPTO_KEY_NAME = "vault-master"
const HMAC_KEY_NAME = "vault-hmac"

// ---------- IndexedDB helpers ----------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        const store = db.createObjectStore(VAULT_STORE, { keyPath: "id" })
        store.createIndex("type", "type", { unique: false })
        store.createIndex("sourceProvider", "sourceProvider", { unique: false })
        store.createIndex("discoveredAt", "discoveredAt", { unique: false })
        store.createIndex("reinjected", "reinjected", { unique: false })
        store.createIndex("contentHash", "contentHash", { unique: false })
      }
      if (!db.objectStoreNames.contains(CRYPTO_STORE)) {
        db.createObjectStore(CRYPTO_STORE, { keyPath: "name" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbDelete(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbGetByIndex<T>(db: IDBDatabase, store: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const idx = tx.objectStore(store).index(indexName)
    const req = idx.getAll(value)
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

// ---------- Encryption ----------

async function getOrCreateKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<{ name: string; key: CryptoKey }>(
    db,
    CRYPTO_STORE,
    CRYPTO_KEY_NAME
  )
  if (existing?.key) return existing.key

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"]
  )
  await idbPut(db, CRYPTO_STORE, { name: CRYPTO_KEY_NAME, key })
  return key
}

async function getOrCreateHmacKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<{ name: string; key: CryptoKey }>(
    db,
    CRYPTO_STORE,
    HMAC_KEY_NAME
  )
  if (existing?.key) return existing.key

  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  await idbPut(db, CRYPTO_STORE, { name: HMAC_KEY_NAME, key })
  return key
}

async function encrypt(key: CryptoKey, data: string): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(data)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  )
  const result = new Uint8Array(iv.length + ciphertext.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), iv.length)
  return result.buffer
}

async function decrypt(key: CryptoKey, buffer: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(buffer)
  const iv = data.slice(0, 12)
  const ciphertext = data.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}

async function computeContentHash(hmacKey: CryptoKey, content: string): Promise<string> {
  const encoded = new TextEncoder().encode(content)
  const signature = await crypto.subtle.sign("HMAC", hmacKey, encoded)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// ---------- Internal stored format ----------

type EncryptedVaultItem = {
  id: string
  encryptedContent: ArrayBuffer
  contentHash: string
  type: string
  subType?: string
  sourceProvider: string
  sourceService: string
  sourceReference: string
  sourceUrl?: string
  discoveredAt: string
  pattern: string
  confidence: number
  metadata: Record<string, unknown>
  reinjected: boolean
  reinjectedProfileId?: string
}

async function decryptVaultItem(
  key: CryptoKey,
  ei: EncryptedVaultItem
): Promise<VaultItem> {
  const content = await decrypt(key, ei.encryptedContent)
  return {
    id: ei.id,
    content,
    type: ei.type as VaultItem["type"],
    subType: ei.subType as VaultItem["subType"],
    source: {
      provider: ei.sourceProvider,
      service: ei.sourceService,
      reference: ei.sourceReference,
      url: ei.sourceUrl,
    },
    discoveredAt: ei.discoveredAt,
    pattern: ei.pattern,
    confidence: ei.confidence,
    metadata: ei.metadata,
    reinjected: ei.reinjected,
    reinjectedProfileId: ei.reinjectedProfileId,
  }
}

// ---------- Public API ----------

export async function getAllVaultItems(): Promise<VaultItem[]> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const encrypted = await idbGetAll<EncryptedVaultItem>(db, VAULT_STORE)
  const items = await Promise.all(
    encrypted.map((ei) => decryptVaultItem(key, ei))
  )
  return items.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime())
}

export async function getVaultItem(id: string): Promise<VaultItem | null> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const ei = await idbGet<EncryptedVaultItem>(db, VAULT_STORE, id)
  if (!ei) return null
  return decryptVaultItem(key, ei)
}

export async function addVaultItem(item: VaultItem): Promise<{ added: boolean; duplicate: boolean }> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const hmacKey = await getOrCreateHmacKey(db)

  // Compute content hash for dedup
  const contentHash = await computeContentHash(hmacKey, item.content)

  // Check for duplicates
  const existing = await idbGetByIndex<EncryptedVaultItem>(db, VAULT_STORE, "contentHash", contentHash)
  if (existing.length > 0) {
    return { added: false, duplicate: true }
  }

  const encryptedContent = await encrypt(key, item.content)

  const ei: EncryptedVaultItem = {
    id: item.id,
    encryptedContent,
    contentHash,
    type: item.type,
    subType: item.subType,
    sourceProvider: item.source.provider,
    sourceService: item.source.service,
    sourceReference: item.source.reference,
    sourceUrl: item.source.url,
    discoveredAt: item.discoveredAt,
    pattern: item.pattern,
    confidence: item.confidence,
    metadata: item.metadata,
    reinjected: item.reinjected,
    reinjectedProfileId: item.reinjectedProfileId,
  }

  await idbPut(db, VAULT_STORE, ei)
  return { added: true, duplicate: false }
}

export async function deleteVaultItem(id: string): Promise<void> {
  const db = await openDB()
  await idbDelete(db, VAULT_STORE, id)
}

export async function clearAllVaultItems(): Promise<void> {
  const db = await openDB()
  await idbClear(db, VAULT_STORE)
}

export async function getVaultStats(): Promise<VaultStats> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const encrypted = await idbGetAll<EncryptedVaultItem>(db, VAULT_STORE)

  const stats: VaultStats = {
    total: encrypted.length,
    byType: {},
    byProvider: {},
    reinjected: 0,
  }

  for (const ei of encrypted) {
    stats.byType[ei.type] = (stats.byType[ei.type] || 0) + 1
    stats.byProvider[ei.sourceProvider] = (stats.byProvider[ei.sourceProvider] || 0) + 1
    if (ei.reinjected) stats.reinjected++
  }

  return stats
}
