"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SCOPE_COMPARISONS } from "@/lib/studio/token-docs-data"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

export function ScopeComparison() {
  const shared = SCOPE_COMPARISONS.filter((s) => s.owa && s.teams)
  const teamsExclusive = SCOPE_COMPARISONS.filter((s) => !s.owa && s.teams)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-500" />
          Shared ({shared.length})
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Teams Web exclusive ({teamsExclusive.length})
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          OWA exclusive (0)
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scope</TableHead>
            <TableHead className="text-center w-36">
              OWA <span className="text-muted-foreground font-mono text-[9px]">(9199bf20)</span>
            </TableHead>
            <TableHead className="text-center w-36">
              Teams Web <span className="text-muted-foreground font-mono text-[9px]">(5e3ce6c0)</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SCOPE_COMPARISONS.map((item) => {
            const isTeamsExclusive = !item.owa && item.teams
            return (
              <TableRow
                key={item.scope}
                className={cn(isTeamsExclusive && "bg-emerald-500/5")}
              >
                <TableCell>
                  <span className={cn(
                    "font-mono text-xs",
                    isTeamsExclusive ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {item.scope}
                  </span>
                  {isTeamsExclusive && (
                    <Badge className="ml-2 text-[8px] text-emerald-400 bg-emerald-500/10">
                      TEAMS ONLY
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.owa ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-400 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.teams ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-400 mx-auto" />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-start gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
        <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
        <span className="text-[11px] text-emerald-400/80">
          Teams Web is the superior extraction target — it includes all OWA scopes plus Mail, Calendar, Sites, Notes, and Tasks access.
        </span>
      </div>
    </div>
  )
}
