"use client"

import { useState, useCallback } from "react"
import { TokenInput } from "@/components/studio/token-input"
import { AnalyzerResults } from "@/components/studio/token-analyzer/analyzer-results"
import { analyzeJwt, type JwtAnalysis } from "@/lib/studio/jwt-decoder"
import { identifyTokenType, type TokenTypeDefinition } from "@/lib/studio/token-types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Terminal, Shield } from "lucide-react"

export default function StudioAnalyzerPage() {
  const [analysis, setAnalysis] = useState<JwtAnalysis | null>(null)
  const [tokenType, setTokenType] = useState<TokenTypeDefinition | null>(null)
  const [rawToken, setRawToken] = useState("")
  const [analyzed, setAnalyzed] = useState(false)

  const handleAnalyze = useCallback((token: string) => {
    setRawToken(token)

    // Try to identify token type from patterns
    const identified = identifyTokenType(token)
    setTokenType(identified)

    // Try JWT decode
    const jwtResult = analyzeJwt(token)
    setAnalysis(jwtResult)

    // If JWT decode worked but we couldn't identify type via pattern, use JWT-based detection
    if (jwtResult && !identified) {
      // The JWT analysis has platform detection, which is sufficient
    }

    setAnalyzed(true)
  }, [])

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          Token Analyzer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Decode, identify, and analyze OAuth2 tokens, JWTs, API keys, and credentials.
          No data is sent externally -- all analysis runs client-side.
        </p>
      </div>

      <TokenInput onAnalyze={handleAnalyze} />

      {analyzed && (
        <AnalyzerResults
          analysis={analysis}
          tokenType={tokenType}
          rawToken={rawToken}
        />
      )}

      {!analyzed && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <Card className="border-border/30 bg-card/30">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Supported Formats</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {["JWT", "OAuth2", "Refresh Token", "API Key", "SA Key JSON"].map((f) => (
                  <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/30">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Analysis Includes</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                <li>Platform detection (Google / Microsoft)</li>
                <li>Claims extraction and labeling</li>
                <li>Scope analysis with risk assessment</li>
                <li>Expiry countdown and OPSEC notes</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/30">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Privacy</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                All analysis is performed locally in the browser.
                Tokens are never transmitted to any server.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
