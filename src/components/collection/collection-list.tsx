"use client"

import { PackagePlus } from "lucide-react"
import type { CollectionItem } from "@/lib/collection-store"
import { CollectionItemCard } from "./collection-item-card"

type CollectionListProps = {
  items: CollectionItem[]
  loading: boolean
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

export function CollectionList({ items, loading, onRemove, onRetry }: CollectionListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] rounded-lg border bg-card animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted/60 mb-4">
          <PackagePlus className="size-8 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No items collected</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Use the collect button on emails, files, and messages to add them here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <CollectionItemCard
          key={item.id}
          item={item}
          onRemove={onRemove}
          onRetry={onRetry}
        />
      ))}
    </div>
  )
}
