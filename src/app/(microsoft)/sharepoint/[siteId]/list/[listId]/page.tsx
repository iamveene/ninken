"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, ListIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceError } from "@/components/ui/service-error"
import { ExportButton } from "@/components/layout/export-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useSharePointListItems,
  useSharePointLists,
  type SharePointListColumn,
} from "@/hooks/use-sharepoint"

const PAGE_SIZE = 25

function renderFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    // Try to detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return formatDistanceToNow(new Date(value), { addSuffix: true })
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) return value.map(renderFieldValue).join(", ")
  if (typeof value === "object") {
    // Handle lookup values with displayName or title
    const obj = value as Record<string, unknown>
    if (obj.displayName) return String(obj.displayName)
    if (obj.title) return String(obj.title)
    if (obj.email) return String(obj.email)
    if (obj.LookupValue) return String(obj.LookupValue)
    return JSON.stringify(value)
  }
  return String(value)
}

export default function SharePointListItemsPage() {
  const params = useParams<{ siteId: string; listId: string }>()
  const router = useRouter()
  const siteId = params.siteId ? decodeURIComponent(params.siteId) : null
  const listId = params.listId ? decodeURIComponent(params.listId) : null

  const [page, setPage] = useState(0)

  const { lists } = useSharePointLists(siteId)
  const list = lists.find((l) => l.id === listId) ?? null

  const { items, columns, loading, error, refetch } = useSharePointListItems(
    siteId,
    listId,
  )

  // Filter to visible, non-internal columns
  const visibleColumns = useMemo(() => {
    const internalFields = new Set([
      "id",
      "ContentType",
      "_ModerationComments",
      "Edit",
      "LinkTitleNoMenu",
      "LinkTitle",
      "DocIcon",
      "ItemChildCount",
      "FolderChildCount",
      "_ComplianceFlags",
      "_ComplianceTag",
      "_ComplianceTagWrittenTime",
      "_ComplianceTagUserId",
      "_UIVersionString",
      "AppAuthor",
      "AppEditor",
    ])
    return columns.filter(
      (col: SharePointListColumn) =>
        !col.hidden && !col.readOnly && !internalFields.has(col.name),
    )
  }, [columns])

  // Use a reasonable set of display columns (cap at 6)
  const displayColumns = useMemo(() => visibleColumns.slice(0, 6), [visibleColumns])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Export data
  const exportData = useMemo(
    () =>
      items.map((item) => {
        const row: Record<string, unknown> = { id: item.id }
        for (const col of visibleColumns) {
          row[col.displayName] = item.fields[col.name]
        }
        return row
      }),
    [items, visibleColumns],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            router.push(`/sharepoint/${encodeURIComponent(siteId!)}`)
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ListIcon className="h-5 w-5 text-emerald-500" />
            {list?.displayName ?? "List"}
          </h1>
          {list?.description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {list.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} items
          </p>
        </div>
        <ExportButton
          data={exportData as Record<string, unknown>[]}
          filename={`sharepoint-list-${list?.displayName ?? listId}`}
          columns={["id", ...visibleColumns.map((c) => c.displayName)]}
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((col) => (
                <TableHead key={col.name} className="text-xs">
                  {col.displayName}
                </TableHead>
              ))}
              <TableHead className="text-xs">Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: displayColumns.length + 1 }).map(
                    (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ),
                  )}
                </TableRow>
              ))
            ) : pagedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={displayColumns.length + 1}
                  className="text-center text-xs text-muted-foreground py-8"
                >
                  No items in this list
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((item) => (
                <TableRow key={item.id}>
                  {displayColumns.map((col) => (
                    <TableCell key={col.name}>
                      <span className="text-xs">
                        {renderFieldValue(item.fields[col.name])}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {item.lastModifiedDateTime
                        ? formatDistanceToNow(
                            new Date(item.lastModifiedDateTime),
                            { addSuffix: true },
                          )
                        : "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
