export type AlertSeverity = "info" | "warning" | "critical"
export type AlertCategory = "email" | "drive" | "calendar" | "directory" | "token" | "audit" | "system"

export type Alert = {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  title: string
  description: string
  timestamp: number
  read: boolean
  dismissed: boolean
  source: string
  actionUrl?: string
  profileId?: string
}

const DB_NAME = "ninken-alerts"
const DB_VERSION = 1
const STORE_NAME = "alerts"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("timestamp", "timestamp", { unique: false })
        store.createIndex("read", "read", { unique: false })
        store.createIndex("category", "category", { unique: false })
        store.createIndex("dismissed", "dismissed", { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function addAlert(
  alert: Omit<Alert, "id" | "timestamp" | "read" | "dismissed">
): Promise<Alert> {
  const db = await openDB()
  const newAlert: Alert = {
    ...alert,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: false,
    dismissed: false,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(newAlert)
    tx.oncomplete = () => resolve(newAlert)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAlerts(options?: {
  limit?: number
  unreadOnly?: boolean
  category?: AlertCategory
}): Promise<Alert[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()

    req.onsuccess = () => {
      let results = (req.result as Alert[])
        .filter((a) => !a.dismissed)
        .sort((a, b) => b.timestamp - a.timestamp)

      if (options?.unreadOnly) {
        results = results.filter((a) => !a.read)
      }
      if (options?.category) {
        results = results.filter((a) => a.category === options.category)
      }
      if (options?.limit) {
        results = results.slice(0, options.limit)
      }

      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function markAsRead(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => {
      const alert = req.result as Alert | undefined
      if (alert) {
        alert.read = true
        store.put(alert)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function markAllAsRead(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const alerts = req.result as Alert[]
      for (const alert of alerts) {
        if (!alert.read) {
          alert.read = true
          store.put(alert)
        }
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dismissAlert(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => {
      const alert = req.result as Alert | undefined
      if (alert) {
        alert.dismissed = true
        store.put(alert)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAlerts(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getUnreadCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const alerts = req.result as Alert[]
      const count = alerts.filter((a) => !a.read && !a.dismissed).length
      resolve(count)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function createSystemAlert(
  title: string,
  description: string,
  severity: AlertSeverity = "info"
): Promise<Alert> {
  return addAlert({
    category: "system",
    severity,
    title,
    description,
    source: "System",
  })
}
