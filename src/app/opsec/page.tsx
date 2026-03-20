"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StealthBadge } from "@/components/studio/stealth-badge"
import {
  STEALTH_TIERS,
  scoreOperation,
  type StealthLevel,
} from "@/lib/studio/stealth-scores"
import { cn } from "@/lib/utils"
import { Eye, Shield, Gauge } from "lucide-react"

const TIER_ORDER: StealthLevel[] = [1, 2, 3, 4, 5]

export default function OpsecPage() {
  const [customParams, setCustomParams] = useState({
    isRead: true,
    isWrite: false,
    isDelete: false,
    targetsAdminApi: false,
    targetsSensitiveData: false,
    isBulkOperation: false,
    createsPeristence: false,
  })

  const customScore = scoreOperation(customParams)

  const toggleParam = (key: keyof typeof customParams) => {
    setCustomParams((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          OPSEC Stealth Reference
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          5-level stealth scoring system for API operations. Understand detection risk before executing.
        </p>
      </div>

      {/* Stealth Calculator */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Stealth Calculator
          </CardTitle>
          <CardDescription className="text-xs">
            Toggle operation characteristics to estimate detection risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(customParams) as (keyof typeof customParams)[]).map((key) => {
              const labels: Record<string, string> = {
                isRead: "Read Operation",
                isWrite: "Write Operation",
                isDelete: "Delete Operation",
                targetsAdminApi: "Admin API",
                targetsSensitiveData: "Sensitive Data",
                isBulkOperation: "Bulk Operation",
                createsPeristence: "Creates Persistence",
              }
              return (
                <button
                  key={key}
                  onClick={() => toggleParam(key)}
                  className={cn(
                    "flex items-center gap-2 rounded border px-3 py-2 text-xs transition-colors",
                    customParams[key]
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/30 bg-black/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "h-2.5 w-2.5 rounded border shrink-0",
                    customParams[key] ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )} />
                  {labels[key]}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 rounded border border-border/50 bg-black/20 px-4 py-3">
            <span className="text-xs text-muted-foreground">Estimated Detection Level:</span>
            <StealthBadge level={customScore} size="md" />
            <span className="text-xs text-muted-foreground ml-auto">
              Detection probability: {STEALTH_TIERS[customScore].detectionProbability}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tier Reference Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          Stealth Tier Reference
        </h2>

        {TIER_ORDER.map((level) => {
          const tier = STEALTH_TIERS[level]
          return (
            <Card key={level} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <StealthBadge level={level} size="md" />
                  <div>
                    <CardTitle className="text-sm">{tier.name}</CardTitle>
                    <CardDescription className="text-xs">{tier.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                    {tier.detectionProbability}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                      Example Operations
                    </h4>
                    <ul className="space-y-1">
                      {tier.examples.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px]">
                          <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                          <span className="text-muted-foreground">{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                      OPSEC Guidance
                    </h4>
                    <ul className="space-y-1">
                      {tier.guidance.map((g, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px]">
                          <span className="mt-1 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                          <span className="text-muted-foreground">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
