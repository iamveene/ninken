"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import type { JwtClaim } from "@/lib/studio/jwt-decoder"

interface ClaimsTableProps {
  claims: JwtClaim[]
}

const CATEGORY_COLORS: Record<string, string> = {
  identity: "text-sky-400 bg-sky-500/10",
  authorization: "text-emerald-400 bg-emerald-500/10",
  metadata: "text-muted-foreground bg-muted/50",
  timing: "text-amber-400 bg-amber-500/10",
  security: "text-orange-400 bg-orange-500/10",
}

function formatClaimValue(value: unknown): string {
  if (typeof value === "number") {
    // Check if it looks like a Unix timestamp (between 2020 and 2040)
    if (value > 1577836800 && value < 2208988800) {
      return `${new Date(value * 1000).toISOString()} (${value})`
    }
    return String(value)
  }
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2)
  return String(value)
}

export function ClaimsTable({ claims }: ClaimsTableProps) {
  const [expanded, setExpanded] = useState(true)

  // Group claims by category
  const grouped = claims.reduce<Record<string, JwtClaim[]>>((acc, claim) => {
    const cat = claim.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(claim)
    return acc
  }, {})

  const categoryOrder = ["identity", "authorization", "timing", "security", "metadata"]
  const sortedCategories = categoryOrder.filter((c) => grouped[c]?.length)

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <button
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => setExpanded(!expanded)}
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          JWT Claims ({claims.length})
          {expanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36 text-xs">Claim</TableHead>
                <TableHead className="w-40 text-xs">Label</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="w-24 text-xs">Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCategories.flatMap((cat) =>
                grouped[cat].map((claim) => (
                  <TableRow key={claim.key} className={cn(claim.sensitive && "bg-red-500/5")}>
                    <TableCell className="font-mono text-[11px] text-foreground/80">
                      {claim.key}
                      {claim.sensitive && <span className="ml-1 text-red-400">*</span>}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{claim.label}</TableCell>
                    <TableCell className="font-mono text-[11px] max-w-xs truncate">
                      {formatClaimValue(claim.value)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] capitalize", CATEGORY_COLORS[claim.category])}
                      >
                        {claim.category}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="mt-2 text-[10px] text-muted-foreground">
            <span className="text-red-400">*</span> = Contains sensitive/PII data
          </div>
        </CardContent>
      )}
    </Card>
  )
}
