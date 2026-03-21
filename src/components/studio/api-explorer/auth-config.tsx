"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { KeyRound, ChevronDown, ChevronRight } from "lucide-react"
import { ActiveTokenResolver } from "./active-token-resolver"

export type AuthType = "none" | "active-token" | "bearer" | "apikey" | "basic"

export interface AuthState {
  type: AuthType
  bearerToken: string
  apiKeyHeader: string
  apiKeyValue: string
  basicUsername: string
  basicPassword: string
  activeToken: string
  activeTokenProvider: string
  activeTokenError: string
}

const DEFAULT_AUTH: AuthState = {
  type: "none",
  bearerToken: "",
  apiKeyHeader: "X-API-Key",
  apiKeyValue: "",
  basicUsername: "",
  basicPassword: "",
  activeToken: "",
  activeTokenProvider: "",
  activeTokenError: "",
}

interface AuthConfigProps {
  value: AuthState
  onChange: (auth: AuthState) => void
}

/**
 * Resolve auth state into HTTP headers to merge into the request.
 */
export function resolveAuthHeaders(auth: AuthState): Record<string, string> {
  switch (auth.type) {
    case "active-token":
      if (auth.activeToken) return { Authorization: `Bearer ${auth.activeToken}` }
      return {}
    case "bearer":
      if (auth.bearerToken) return { Authorization: `Bearer ${auth.bearerToken}` }
      return {}
    case "apikey":
      if (auth.apiKeyHeader && auth.apiKeyValue) return { [auth.apiKeyHeader]: auth.apiKeyValue }
      return {}
    case "basic": {
      if (auth.basicUsername || auth.basicPassword) {
        const encoded = btoa(`${auth.basicUsername}:${auth.basicPassword}`)
        return { Authorization: `Basic ${encoded}` }
      }
      return {}
    }
    default:
      return {}
  }
}

export function createDefaultAuth(): AuthState {
  return { ...DEFAULT_AUTH }
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "active-token", label: "Active Token" },
  { value: "bearer", label: "Bearer Token" },
  { value: "apikey", label: "API Key" },
  { value: "basic", label: "Basic Auth" },
]

export function AuthConfig({ value, onChange }: AuthConfigProps) {
  const [expanded, setExpanded] = useState(value.type !== "none")

  const update = useCallback(
    (partial: Partial<AuthState>) => {
      onChange({ ...value, ...partial })
    },
    [value, onChange],
  )

  // Auto-expand when type changes from none
  useEffect(() => {
    if (value.type !== "none") setExpanded(true)
  }, [value.type])

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <KeyRound className="h-3 w-3" />
        Authorization
        {value.type !== "none" && (
          <Badge variant="secondary" className="text-[9px] ml-1">
            {AUTH_TYPES.find((t) => t.value === value.type)?.label}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="space-y-2 pl-5">
          {/* Auth type selector */}
          <div className="flex gap-1">
            {AUTH_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  value.type === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => update({ type: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Active Token */}
          {value.type === "active-token" && (
            <ActiveTokenResolver
              onResolve={(token, provider) =>
                update({
                  activeToken: token,
                  activeTokenProvider: provider,
                  activeTokenError: "",
                })
              }
              resolvedToken={value.activeToken}
              resolvedProvider={value.activeTokenProvider}
              error={value.activeTokenError}
            />
          )}

          {/* Bearer Token */}
          {value.type === "bearer" && (
            <div className="space-y-1.5">
              <Input
                value={value.bearerToken}
                onChange={(e) => update({ bearerToken: e.target.value })}
                placeholder="Enter bearer token..."
                className="h-7 text-xs font-mono"
              />
            </div>
          )}

          {/* API Key */}
          {value.type === "apikey" && (
            <div className="flex gap-2">
              <Input
                value={value.apiKeyHeader}
                onChange={(e) => update({ apiKeyHeader: e.target.value })}
                placeholder="Header name"
                className="h-7 text-xs font-mono w-1/3"
              />
              <Input
                value={value.apiKeyValue}
                onChange={(e) => update({ apiKeyValue: e.target.value })}
                placeholder="API key value"
                className="h-7 text-xs font-mono flex-1"
              />
            </div>
          )}

          {/* Basic Auth */}
          {value.type === "basic" && (
            <div className="flex gap-2">
              <Input
                value={value.basicUsername}
                onChange={(e) => update({ basicUsername: e.target.value })}
                placeholder="Username"
                className="h-7 text-xs w-1/2"
              />
              <Input
                type="password"
                value={value.basicPassword}
                onChange={(e) => update({ basicPassword: e.target.value })}
                placeholder="Password"
                className="h-7 text-xs w-1/2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
