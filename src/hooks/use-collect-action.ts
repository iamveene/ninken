"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import {
  addItem,
  itemExists,
  type CollectionItemType,
  type CollectionSource,
} from "@/lib/collection-store"
import { getCollectionManager } from "@/lib/collection-manager"

export type CollectParams = {
  type: CollectionItemType
  source: CollectionSource
  title: string
  subtitle?: string
  sourceId: string
  downloadUrl?: string
  mimeType?: string
  sizeBytes?: number
  metadata?: Record<string, unknown>
}

export function useCollectAction() {
  const collect = useCallback(async (params: CollectParams) => {
    try {
      // Check for duplicates
      const exists = await itemExists(params.sourceId, params.source)
      if (exists) {
        toast.info("Already collected", {
          description: params.title,
        })
        return null
      }

      const item = await addItem(params)

      toast.success("Added to collection", {
        description: params.title,
      })

      // Auto-start queue processing
      const manager = getCollectionManager()
      if (!manager.isProcessing && params.downloadUrl) {
        manager.startProcessing()
      }

      return item
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to collect item"
      toast.error("Collection failed", { description: msg })
      return null
    }
  }, [])

  return { collect }
}
