"use client"

import JSZip from "jszip"
import { getAllItems, getBlob, type CollectionItem, type CollectionBlob } from "@/lib/collection-store"
import { getAllProfiles } from "@/lib/token-store"
import { toCsv } from "@/lib/export"
import type { StoredProfile } from "@/lib/providers/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportDataSource = "items" | "blobs" | "profiles"
export type ExportFormat = "json" | "csv" | "bloodhound"

export type ExportOptions = {
  sources: ExportDataSource[]
  format: ExportFormat
  onProgress?: (pct: number, message: string) => void
}

export type ExportResult = {
  blob: Blob
  filename: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip credentials from profiles — only export metadata. */
function sanitizeProfile(p: StoredProfile) {
  return {
    id: p.id,
    provider: p.provider,
    email: p.email ?? null,
    label: p.label ?? null,
    addedAt: p.addedAt,
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
}

async function gatherData(
  sources: ExportDataSource[],
  onProgress?: (pct: number, msg: string) => void,
) {
  const data: {
    items?: CollectionItem[]
    blobs?: CollectionBlob[]
    profiles?: ReturnType<typeof sanitizeProfile>[]
  } = {}

  let step = 0
  const total = sources.length

  if (sources.includes("items")) {
    onProgress?.(Math.round((step / total) * 50), "Reading collection items...")
    data.items = await getAllItems()
    step++
  }

  if (sources.includes("blobs")) {
    onProgress?.(Math.round((step / total) * 50), "Reading collection blobs...")
    const items = data.items ?? await getAllItems()
    const blobs: CollectionBlob[] = []
    for (const item of items) {
      const blob = await getBlob(item.id)
      if (blob) blobs.push(blob)
    }
    data.blobs = blobs
    step++
  }

  if (sources.includes("profiles")) {
    onProgress?.(Math.round((step / total) * 50), "Reading profile metadata...")
    const raw = await getAllProfiles()
    data.profiles = raw.map(sanitizeProfile)
    step++
  }

  return data
}

// ---------------------------------------------------------------------------
// JSON Bundle
// ---------------------------------------------------------------------------

export async function exportJsonBundle(options: ExportOptions): Promise<ExportResult> {
  const { sources, onProgress } = options
  const data = await gatherData(sources, onProgress)

  onProgress?.(60, "Building ZIP archive...")
  const zip = new JSZip()

  if (data.items) {
    zip.file("collection-items.json", JSON.stringify(data.items, null, 2))
  }

  if (data.blobs) {
    const blobsFolder = zip.folder("blobs")
    for (const b of data.blobs) {
      blobsFolder?.file(b.filename || `${b.id}.bin`, b.data)
    }
    // Also write a manifest
    const manifest = data.blobs.map((b) => ({
      id: b.id,
      filename: b.filename,
      mimeType: b.mimeType,
      sizeBytes: b.data.byteLength,
    }))
    zip.file("blobs-manifest.json", JSON.stringify(manifest, null, 2))
  }

  if (data.profiles) {
    zip.file("profiles.json", JSON.stringify(data.profiles, null, 2))
  }

  onProgress?.(80, "Compressing...")
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
  const filename = `ninken-export-${timestamp()}.zip`

  onProgress?.(100, "Done")
  return { blob, filename }
}

// ---------------------------------------------------------------------------
// CSV Bundle
// ---------------------------------------------------------------------------

export async function exportCsvBundle(options: ExportOptions): Promise<ExportResult> {
  const { sources, onProgress } = options
  const data = await gatherData(sources, onProgress)

  onProgress?.(60, "Building CSV files...")
  const zip = new JSZip()

  if (data.items) {
    zip.file("collection-items.csv", toCsv(data.items as unknown as Record<string, unknown>[]))
  }

  if (data.blobs) {
    // Blobs can't be CSV — write manifest only
    const manifest = data.blobs.map((b) => ({
      id: b.id,
      filename: b.filename,
      mimeType: b.mimeType,
      sizeBytes: b.data.byteLength,
    }))
    zip.file("blobs-manifest.csv", toCsv(manifest as unknown as Record<string, unknown>[]))
  }

  if (data.profiles) {
    zip.file("profiles.csv", toCsv(data.profiles as unknown as Record<string, unknown>[]))
  }

  onProgress?.(80, "Compressing...")
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
  const filename = `ninken-export-${timestamp()}.csv.zip`

  onProgress?.(100, "Done")
  return { blob, filename }
}

// ---------------------------------------------------------------------------
// BloodHound JSON
// ---------------------------------------------------------------------------

type BHNode = {
  Properties: Record<string, unknown>
  Aces: unknown[]
  Members?: unknown[]
}

type BHFile = {
  data: BHNode[]
  meta: { methods: number; type: string; count: number; version: number }
}

function buildBloodHoundFile(type: string, nodes: BHNode[]): BHFile {
  return {
    data: nodes,
    meta: { methods: 0, type, count: nodes.length, version: 5 },
  }
}

function itemToBHNode(item: CollectionItem): BHNode {
  const meta = (item.metadata ?? {}) as Record<string, unknown>
  const domain = (meta.domain as string) ?? "UNKNOWN"
  const name = (meta.displayName as string) ?? item.title
  const objectId = item.sourceId

  return {
    Properties: {
      name: `${name}@${domain}`.toUpperCase(),
      objectid: objectId,
      displayname: name,
      email: (meta.email as string) ?? null,
      source: item.source,
      type: item.type,
      enabled: true,
      ...meta,
    },
    Aces: [],
    Members: (meta.members as unknown[]) ?? [],
  }
}

export async function exportBloodHound(options: ExportOptions): Promise<ExportResult> {
  const { onProgress } = options

  onProgress?.(10, "Reading collection items...")
  const allItems = await getAllItems()

  onProgress?.(40, "Mapping to BloodHound nodes...")

  // Partition items into user, group, computer nodes based on item type
  const groupTypes = new Set(["group"])
  const computerTypes = new Set(["repo", "project"])

  const users: BHNode[] = []
  const groups: BHNode[] = []
  const computers: BHNode[] = []

  for (const item of allItems) {
    const node = itemToBHNode(item)
    if (groupTypes.has(item.type)) {
      groups.push(node)
    } else if (computerTypes.has(item.type)) {
      computers.push(node)
    } else {
      users.push(node)
    }
  }

  onProgress?.(70, "Building BloodHound ZIP...")
  const zip = new JSZip()

  zip.file("users.json", JSON.stringify(buildBloodHoundFile("users", users), null, 2))
  zip.file("groups.json", JSON.stringify(buildBloodHoundFile("groups", groups), null, 2))
  zip.file("computers.json", JSON.stringify(buildBloodHoundFile("computers", computers), null, 2))

  onProgress?.(90, "Compressing...")
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
  const filename = `ninken-bloodhound-${timestamp()}.zip`

  onProgress?.(100, "Done")
  return { blob, filename }
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export async function runExport(options: ExportOptions): Promise<ExportResult> {
  switch (options.format) {
    case "json":
      return exportJsonBundle(options)
    case "csv":
      return exportCsvBundle(options)
    case "bloodhound":
      return exportBloodHound(options)
  }
}
