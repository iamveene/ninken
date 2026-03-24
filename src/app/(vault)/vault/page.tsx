"use client"

import { useState, useMemo, useCallback } from "react"
import { KeyRound, Trash2, Search, Filter } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useVault } from "@/hooks/use-vault"
import { VaultStats } from "@/components/vault/vault-stats"
import { VaultTable } from "@/components/vault/vault-table"
import { ReinjectDialog } from "@/components/vault/reinject-dialog"
import type { VaultItem, VaultItemType } from "@/lib/vault/types"

const VAULT_TYPES: VaultItemType[] = ["aws", "gcp", "github", "microsoft", "slack", "gitlab", "generic", "pii", "url", "infrastructure"]

export default function VaultPage() {
  const { items, stats, loading, removeItem, clearAll } = useVault()
  const [typeFilter, setTypeFilter] = useState<VaultItemType | "all">("all")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [reinjectItem, setReinjectItem] = useState<VaultItem | null>(null)
  const [reinjectOpen, setReinjectOpen] = useState(false)

  // Unique providers from items
  const availableProviders = useMemo(() => {
    const providers = new Set(items.map((i) => i.source.provider))
    return Array.from(providers).sort()
  }, [items])

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items
    if (typeFilter !== "all") {
      result = result.filter((i) => i.type === typeFilter)
    }
    if (providerFilter !== "all") {
      result = result.filter((i) => i.source.provider === providerFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (i) =>
          i.source.reference.toLowerCase().includes(q) ||
          i.source.service.toLowerCase().includes(q) ||
          i.pattern.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q)
      )
    }
    return result
  }, [items, typeFilter, providerFilter, searchQuery])

  const handleDelete = useCallback(
    async (id: string) => {
      await removeItem(id)
      toast.success("Vault item deleted")
    },
    [removeItem]
  )

  const handleReinject = useCallback((item: VaultItem) => {
    setReinjectItem(item)
    setReinjectOpen(true)
  }, [])

  const handleClearAll = useCallback(async () => {
    if (!confirm("Delete all vault items? This cannot be undone.")) return
    await clearAll()
    toast.success("Vault cleared")
  }, [clearAll])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Credential inventory with AI extraction from Hunt findings. Copy, reinject, or search.
          </p>
        </div>
      </div>

      <VaultStats stats={stats} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter((v ?? "all") as VaultItemType | "all")}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {VAULT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={providerFilter}
            onValueChange={(v) => setProviderFilter(v ?? "all")}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {availableProviders.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vault..."
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={handleClearAll}
            disabled={stats.total === 0}
          >
            <Trash2 className="size-3.5" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <KeyRound className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {stats.total === 0
              ? "No items in the Vault"
              : "No items match your filters"}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {stats.total === 0
              ? "Extract items from Hunt findings using AI extraction to populate the Vault."
              : "Try adjusting your filters or search query."}
          </p>
        </div>
      ) : (
        <VaultTable
          items={filteredItems}
          onDelete={handleDelete}
          onReinject={handleReinject}
        />
      )}

      {/* Reinject dialog */}
      <ReinjectDialog
        item={reinjectItem}
        open={reinjectOpen}
        onOpenChange={setReinjectOpen}
      />
    </div>
  )
}
