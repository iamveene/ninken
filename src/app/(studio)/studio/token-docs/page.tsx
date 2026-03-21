"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TokenTable } from "@/components/studio/token-docs/token-table"
import { ScopeComparison } from "@/components/studio/token-docs/scope-comparison"
import { KQL_QUERIES, MITIGATIONS } from "@/lib/studio/token-docs-data"
import { BookOpen, Shield, Search as SearchIcon, Copy, Check } from "lucide-react"
import { useState } from "react"

function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="bg-black/30 rounded-md p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded bg-muted/50 hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

export default function TokenDocsPage() {
  return (
    <div className="flex flex-col gap-8 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          Token Documentation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive reference for Microsoft token types, scopes, refresh capabilities, and Defender detection guidance.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Microsoft Token Types
          </h2>
          <Badge variant="outline" className="text-[9px]">9 types</Badge>
        </div>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <TokenTable />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            OWA vs Teams Web Scopes
          </h2>
          <Badge variant="outline" className="text-[9px]">SPA comparison</Badge>
        </div>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4">
            <ScopeComparison />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Defender Detection Guidance
          </h2>
          <Badge variant="outline" className="text-[9px]">KQL</Badge>
        </div>
        <div className="space-y-3">
          {KQL_QUERIES.map((kql) => (
            <Card key={kql.title} className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium">{kql.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CopyableCode code={kql.query} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mitigation Guidance
          </h2>
        </div>
        <div className="space-y-2">
          {MITIGATIONS.map((m) => (
            <Card key={m.title} className="border-border/50 bg-card/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium">{m.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
