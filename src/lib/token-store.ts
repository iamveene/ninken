"use client"

import type { ProviderId, BaseCredential, StoredProfile } from "./providers/types"

const DB_NAME = "ninken-profiles"
const DB_VERSION = 1
const PROFILES_STORE = "profiles"
const CRYPTO_STORE = "crypto"
const CRYPTO_KEY_NAME = "master"
const ACTIVE_PROFILE_KEY = "ninken_active_profile"

// ---------- IndexedDB helpers ----------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: "id" })
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

async function encrypt(key: CryptoKey, data: string): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(data)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  )
  // Prepend IV to ciphertext
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

// Internal stored format (credential is encrypted)
type EncryptedProfile = {
  id: string
  provider: ProviderId
  encryptedCredential: ArrayBuffer
  email?: string
  label?: string
  addedAt: number
  // Multi-token: encrypted JSON blob of Record<ProviderId, BaseCredential>
  encryptedTokens?: ArrayBuffer
  activeProvider?: ProviderId
}

async function decryptProfile(
  key: CryptoKey,
  ep: EncryptedProfile
): Promise<StoredProfile> {
  const credentialJson = await decrypt(key, ep.encryptedCredential)
  const credential = JSON.parse(credentialJson) as BaseCredential

  // Decrypt multi-token map if present
  let tokens: Partial<Record<ProviderId, BaseCredential>> | undefined
  if (ep.encryptedTokens) {
    const tokensJson = await decrypt(key, ep.encryptedTokens)
    tokens = JSON.parse(tokensJson) as Partial<Record<ProviderId, BaseCredential>>
  }

  return {
    id: ep.id,
    provider: ep.provider,
    credential,
    email: ep.email,
    label: ep.label,
    addedAt: ep.addedAt,
    tokens,
    activeProvider: ep.activeProvider,
  }
}

// ---------- Public API ----------

export async function getAllProfiles(): Promise<StoredProfile[]> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const encrypted = await idbGetAll<EncryptedProfile>(db, PROFILES_STORE)
  const profiles = await Promise.all(
    encrypted.map((ep) => decryptProfile(key, ep))
  )
  return profiles.sort((a, b) => a.addedAt - b.addedAt)
}

export async function getProfile(id: string): Promise<StoredProfile | null> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const ep = await idbGet<EncryptedProfile>(db, PROFILES_STORE, id)
  if (!ep) return null
  return decryptProfile(key, ep)
}

export async function addProfile(
  provider: ProviderId,
  credential: BaseCredential,
  email?: string
): Promise<StoredProfile> {
  const db = await openDB()
  const key = await getOrCreateKey(db)

  const tokens: Partial<Record<ProviderId, BaseCredential>> = { [provider]: credential }

  const profile: StoredProfile = {
    id: crypto.randomUUID(),
    provider,
    credential,
    email,
    addedAt: Date.now(),
    tokens,
    activeProvider: provider,
  }

  const encryptedCredential = await encrypt(
    key,
    JSON.stringify(credential)
  )
  const encryptedTokens = await encrypt(
    key,
    JSON.stringify(tokens)
  )

  const ep: EncryptedProfile = {
    id: profile.id,
    provider: profile.provider,
    encryptedCredential,
    email: profile.email,
    label: profile.label,
    addedAt: profile.addedAt,
    encryptedTokens,
    activeProvider: provider,
  }

  await idbPut(db, PROFILES_STORE, ep)
  return profile
}

export async function removeProfile(id: string): Promise<void> {
  const db = await openDB()
  await idbDelete(db, PROFILES_STORE, id)

  // If the removed profile was active, clear active
  if (getActiveProfileId() === id) {
    const remaining = await idbGetAll<EncryptedProfile>(db, PROFILES_STORE)
    if (remaining.length > 0) {
      setActiveProfileId(remaining[0].id)
    } else {
      localStorage.removeItem(ACTIVE_PROFILE_KEY)
    }
  }
}

export async function updateProfileEmail(
  id: string,
  email: string
): Promise<void> {
  const db = await openDB()
  const ep = await idbGet<EncryptedProfile>(db, PROFILES_STORE, id)
  if (!ep) return
  ep.email = email
  await idbPut(db, PROFILES_STORE, ep)
}

export async function updateProfileLabel(
  id: string,
  label: string
): Promise<void> {
  const db = await openDB()
  const ep = await idbGet<EncryptedProfile>(db, PROFILES_STORE, id)
  if (!ep) return
  ep.label = label
  await idbPut(db, PROFILES_STORE, ep)
}

export async function clearAllProfiles(): Promise<void> {
  const db = await openDB()
  await idbClear(db, PROFILES_STORE)
  localStorage.removeItem(ACTIVE_PROFILE_KEY)
}

// ---------- Multi-token operations ----------

/**
 * Link an additional provider credential to an existing profile.
 * Creates the tokens map if it doesn't exist yet.
 */
export async function addTokenToProfile(
  profileId: string,
  provider: ProviderId,
  credential: BaseCredential
): Promise<void> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const ep = await idbGet<EncryptedProfile>(db, PROFILES_STORE, profileId)
  if (!ep) throw new Error("Profile not found")

  // Decrypt existing tokens map (or build from primary credential)
  let tokens: Partial<Record<ProviderId, BaseCredential>>
  if (ep.encryptedTokens) {
    const tokensJson = await decrypt(key, ep.encryptedTokens)
    tokens = JSON.parse(tokensJson)
  } else {
    // Bootstrap from legacy single-credential profile
    const primaryJson = await decrypt(key, ep.encryptedCredential)
    const primaryCred = JSON.parse(primaryJson) as BaseCredential
    tokens = { [ep.provider]: primaryCred }
  }

  // Add the new provider's credential
  tokens[provider] = credential

  // Encrypt and save
  ep.encryptedTokens = await encrypt(key, JSON.stringify(tokens))
  await idbPut(db, PROFILES_STORE, ep)
}

/**
 * Remove a linked provider credential from a profile.
 * Cannot remove the primary provider (profile.provider).
 */
export async function removeTokenFromProfile(
  profileId: string,
  provider: ProviderId
): Promise<void> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const ep = await idbGet<EncryptedProfile>(db, PROFILES_STORE, profileId)
  if (!ep) throw new Error("Profile not found")
  if (provider === ep.provider) {
    throw new Error("Cannot remove the primary provider from a profile")
  }

  if (!ep.encryptedTokens) return // Nothing to remove

  const tokensJson = await decrypt(key, ep.encryptedTokens)
  const tokens = JSON.parse(tokensJson) as Partial<Record<ProviderId, BaseCredential>>
  delete tokens[provider]

  ep.encryptedTokens = await encrypt(key, JSON.stringify(tokens))

  // If the removed provider was active, fall back to primary
  if (ep.activeProvider === provider) {
    ep.activeProvider = ep.provider
  }

  await idbPut(db, PROFILES_STORE, ep)
}

/**
 * Switch the active provider within a multi-token profile.
 * The provider must already be linked to the profile.
 */
export async function setActiveProvider(
  profileId: string,
  provider: ProviderId
): Promise<void> {
  const db = await openDB()
  const key = await getOrCreateKey(db)
  const ep = await idbGet<EncryptedProfile>(db, PROFILES_STORE, profileId)
  if (!ep) throw new Error("Profile not found")

  // Verify the provider is linked
  if (ep.encryptedTokens) {
    const tokensJson = await decrypt(key, ep.encryptedTokens)
    const tokens = JSON.parse(tokensJson) as Partial<Record<ProviderId, BaseCredential>>
    if (!tokens[provider]) {
      throw new Error(`Provider ${provider} is not linked to this profile`)
    }
  } else if (provider !== ep.provider) {
    throw new Error(`Provider ${provider} is not linked to this profile`)
  }

  ep.activeProvider = provider
  await idbPut(db, PROFILES_STORE, ep)
}

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_PROFILE_KEY)
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id)
}
