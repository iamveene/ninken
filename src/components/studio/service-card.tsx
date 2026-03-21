"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StealthBadge } from "./stealth-badge"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import type { StealthLevel } from "@/lib/studio/stealth-scores"

interface EndpointItem {
  method: string
  path: string
  description: string
  stealthLevel: StealthLevel
  mutating: boolean
  useCase?: string
}

interface ServiceCardProps {
  name: string
  description: string
  category: string
  stealthLevel: StealthLevel
  commonlyMonitored: boolean
  scopes: string[]
  endpoints: EndpointItem[]
  docsUrl: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-400",
  POST: "text-sky-400",
  PUT: "text-amber-400",
  PATCH: "text-orange-400",
  DELETE: "text-red-400",
}

export function ServiceCard({
  name,
  description,
  category,
  stealthLevel,
  commonlyMonitored,
  scopes,
  endpoints,
  docsUrl,
}: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              {name}
              <Badge variant="outline" className="text-[9px] font-mono uppercase">
                {category}
              </Badge>
              {commonlyMonitored && (
                <Badge variant="destructive" className="text-[9px]">
                  Monitored
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
          <StealthBadge level={stealthLevel} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Scopes */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Required Scopes</div>
          <div className="flex flex-wrap gap-1">
            {scopes.map((scope) => {
              const short = scope.replace("https://www.googleapis.com/auth/", "")
              return (
                <span key={scope} className="inline-flex rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {short}
                </span>
              )
            })}
          </div>
        </div>

        {/* Endpoints toggle */}
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {endpoints.length} endpoints
        </button>

        {expanded && (
          <div className="space-y-1.5">
            {endpoints.map((ep, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded border border-border/30 bg-black/10 px-2 py-1.5 text-[11px]"
              >
                <span className={cn("font-mono font-bold w-10 shrink-0", METHOD_COLORS[ep.method] ?? "text-muted-foreground")}>
                  {ep.method}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-foreground/80 truncate">{ep.path}</div>
                  <div className="text-muted-foreground">{ep.description}</div>
                  {ep.useCase && (
                    <div className="text-muted-foreground/70 italic mt-0.5">{ep.useCase}</div>
                  )}
                </div>
                <StealthBadge level={ep.stealthLevel} showLabel={false} size="sm" />
              </div>
            ))}
          </div>
        )}

        {/* Docs link */}
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Documentation
        </a>
      </CardContent>
    </Card>
  )
}
