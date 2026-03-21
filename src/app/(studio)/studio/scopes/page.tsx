"use client"

import { useState, useCallback } from "react"
import { ScopeSelector } from "@/components/studio/scope-calculator/scope-selector"
import { ReverseAnalyzer } from "@/components/studio/scope-calculator/reverse-analyzer"
import { GapAnalysis } from "@/components/studio/scope-calculator/gap-analysis"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ShieldCheck } from "lucide-react"

export default function ScopeCalculatorPage() {
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [platform, setPlatform] = useState<"all" | "google" | "microsoft">("all")

  const toggleScope = useCallback((scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    )
  }, [])

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          Scope Calculator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select OAuth2 scopes to see what services they unlock, assess risk, and identify gaps in access coverage.
        </p>
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-muted-foreground uppercase tracking-wider">Platform:</span>
        {(["all", "google", "microsoft"] as const).map((p) => (
          <button
            key={p}
            className={`px-2 py-1 rounded font-mono uppercase transition-colors ${
              platform === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setPlatform(p)}
          >
            {p}
          </button>
        ))}
        {selectedScopes.length > 0 && (
          <button
            className="ml-auto px-2 py-1 rounded text-[10px] font-mono text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={() => setSelectedScopes([])}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Left: Scope selector */}
        <div>
          <ScopeSelector
            platform={platform}
            selectedScopes={selectedScopes}
            onToggleScope={toggleScope}
          />
        </div>

        {/* Right: Analysis */}
        <div className="space-y-4">
          <Tabs defaultValue="services">
            <TabsList>
              <TabsTrigger value="services">Unlocked Services</TabsTrigger>
              <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
            </TabsList>
            <TabsContent value="services" className="mt-4">
              <ReverseAnalyzer selectedScopes={selectedScopes} />
            </TabsContent>
            <TabsContent value="gaps" className="mt-4">
              <GapAnalysis selectedScopes={selectedScopes} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
