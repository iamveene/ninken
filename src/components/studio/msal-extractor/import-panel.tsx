"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useProvider } from "@/components/providers/provider-context"
import { Import, CheckCircle, AlertTriangle, User, Key, Globe } from "lucide-react"

interface ParsedPreview {
  provider: string
  credentialKind: string
  account?: string
  client_id?: string
  tenant_id?: string
  scope?: string[]
  resourceCount: number
  hasRefreshToken: boolean
  hasAccessToken: boolean
}

function parsePreview(raw: unknown): ParsedPreview | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>

  return {
    provider: (obj.provider as string) ?? "unknown",
    credentialKind: (obj.credentialKind as string) ?? "unknown",
    account: obj.account as string | undefined,
    client_id: obj.client_id as string | undefined,
    tenant_id: obj.tenant_id as string | undefined,
    scope: Array.isArray(obj.scope) ? (obj.scope as string[]) : undefined,
    resourceCount: obj.resource_tokens
      ? Object.keys(obj.resource_tokens as object).length
      : 0,
    hasRefreshToken: !!(obj.refresh_token),
    hasAccessToken: !!(obj.access_token),
  }
}

export function ImportPanel() {
  const [input, setInput] = useState("")
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const { addCredential } = useProvider()

  const parsedJson = useMemo(() => {
    if (!input.trim()) return null
    try {
      return JSON.parse(input) as unknown
    } catch {
      return null
    }
  }, [input])

  const parsed = useMemo(() => {
    return parsedJson ? parsePreview(parsedJson) : null
  }, [parsedJson])

  const handleImport = async () => {
    if (!parsedJson) {
      setStatus("error")
      setErrorMsg("Invalid JSON -- check the pasted content")
      return
    }

    const result = await addCredential(parsedJson)
    if (result.success) {
      setStatus("success")
      setErrorMsg("")
      setInput("")
    } else {
      setStatus("error")
      setErrorMsg(result.error ?? "Import failed")
    }
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Import className="h-4 w-4 text-muted-foreground" />
          Import Extracted Token
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setStatus("idle")
            setErrorMsg("")
          }}
          placeholder='Paste the extracted JSON credential here...'
          className="font-mono text-[11px] min-h-24 max-h-48"
        />

        {parsed && (
          <div className="rounded-md border border-border/30 bg-black/20 p-3 space-y-2">
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Detected Credential
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px] gap-1">
                <Globe className="h-2.5 w-2.5" />
                {parsed.provider}
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Key className="h-2.5 w-2.5" />
                {parsed.credentialKind}
              </Badge>
              {parsed.account && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <User className="h-2.5 w-2.5" />
                  {parsed.account}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-1">
              {parsed.client_id && (
                <div>
                  <span className="text-muted-foreground/60">Client ID:</span>{" "}
                  <span className="font-mono">{parsed.client_id.slice(0, 8)}...</span>
                </div>
              )}
              {parsed.tenant_id && (
                <div>
                  <span className="text-muted-foreground/60">Tenant:</span>{" "}
                  <span className="font-mono">{parsed.tenant_id.slice(0, 8)}...</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground/60">Refresh Token:</span>{" "}
                {parsed.hasRefreshToken ? (
                  <span className="text-emerald-400">present</span>
                ) : (
                  <span className="text-red-400">missing</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground/60">Access Token:</span>{" "}
                {parsed.hasAccessToken ? (
                  <span className="text-emerald-400">present</span>
                ) : (
                  <span className="text-amber-400">missing</span>
                )}
              </div>
              {parsed.resourceCount > 0 && (
                <div>
                  <span className="text-muted-foreground/60">Resource Tokens:</span>{" "}
                  {parsed.resourceCount}
                </div>
              )}
              {parsed.scope && (
                <div className="col-span-2">
                  <span className="text-muted-foreground/60">Scopes:</span>{" "}
                  {parsed.scope.length} detected
                </div>
              )}
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Token imported successfully
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errorMsg}
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!parsedJson || !parsed}
          size="sm"
          className="w-full"
        >
          <Import className="h-3.5 w-3.5" />
          Import to Ninken
        </Button>
      </CardContent>
    </Card>
  )
}
