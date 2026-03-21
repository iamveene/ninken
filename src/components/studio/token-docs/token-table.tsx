"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TOKEN_TYPES, type TokenTypeEntry, type RefreshCapability } from "@/lib/studio/token-docs-data"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react"

type SortField = "tokenType" | "credentialKind" | "serverRefresh" | "foci"
type SortDir = "asc" | "desc"

const REFRESH_STYLES: Record<RefreshCapability, string> = {
  server: "text-emerald-400 bg-emerald-500/10",
  "browser-only": "text-amber-400 bg-amber-500/10",
  none: "text-red-400 bg-red-500/10",
}

export function TokenTable() {
  const [sortField, setSortField] = useState<SortField>("tokenType")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const copy = [...TOKEN_TYPES]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortField === "tokenType") cmp = a.tokenType.localeCompare(b.tokenType)
      else if (sortField === "credentialKind") cmp = a.credentialKind.localeCompare(b.credentialKind)
      else if (sortField === "serverRefresh") cmp = a.serverRefresh.localeCompare(b.serverRefresh)
      else if (sortField === "foci") cmp = Number(a.foci) - Number(b.foci)
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
    >
      {children}
      <ArrowUpDown className={cn("h-3 w-3", sortField === field ? "text-foreground" : "text-muted-foreground/50")} />
    </button>
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>
            <SortButton field="tokenType">Token Type</SortButton>
          </TableHead>
          <TableHead>Client ID</TableHead>
          <TableHead>
            <SortButton field="credentialKind">Credential</SortButton>
          </TableHead>
          <TableHead>
            <SortButton field="serverRefresh">Server Refresh</SortButton>
          </TableHead>
          <TableHead>
            <SortButton field="foci">FOCI</SortButton>
          </TableHead>
          <TableHead>Key Scopes</TableHead>
          <TableHead>Limitations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry) => (
          <TokenRow
            key={entry.id}
            entry={entry}
            isExpanded={expandedId === entry.id}
            onToggle={() => toggleExpand(entry.id)}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function TokenRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: TokenTypeEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasScopes = entry.detailedScopes && entry.detailedScopes.length > 0

  return (
    <>
      <TableRow
        className={cn(hasScopes && "cursor-pointer", isExpanded && "border-b-0")}
        onClick={hasScopes ? onToggle : undefined}
      >
        <TableCell className="w-8 px-1">
          {hasScopes && (
            isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium text-xs">{entry.tokenType}</TableCell>
        <TableCell className="font-mono text-[10px] text-muted-foreground">{entry.clientId}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[9px] font-mono">
            {entry.credentialKind}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge className={cn("text-[9px]", REFRESH_STYLES[entry.serverRefresh])}>
            {entry.refreshLabel}
          </Badge>
        </TableCell>
        <TableCell>
          {entry.foci ? (
            <Badge className="text-[9px] text-emerald-400 bg-emerald-500/10">YES</Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">NO</span>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-48">{entry.keyScopes}</TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-40">{entry.limitations}</TableCell>
      </TableRow>
      {isExpanded && entry.detailedScopes && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={7} className="pb-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Scopes ({entry.detailedScopes.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {entry.detailedScopes.map((scope) => (
                <Badge key={scope} variant="secondary" className="text-[10px] font-mono">
                  {scope}
                </Badge>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
