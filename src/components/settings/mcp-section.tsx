"use client"

import { useState, useEffect, useCallback } from "react"
import { Copy, Check, Server, Terminal, CheckCircle2, Play, Square, Circle } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TOOL_GROUPS: Record<string, string[]> = {
  "Core": ["get_ninken_status", "list_profiles", "switch_profile", "list_capabilities", "get_token_scopes", "get_audit_overview", "get_ai_config", "get_recent_events", "run_custom_query", "load_credential", "load_credential_file"],
  "Gmail & Calendar": ["search_gmail", "get_gmail_message", "list_calendar_events"],
  "Drive": ["search_drive", "list_drive_files"],
  "GWS Audit": ["list_gws_users", "list_gws_groups", "list_gws_admin_reports"],
  "Microsoft": ["list_entra_users", "list_entra_groups", "list_entra_roles", "search_outlook", "list_onedrive_files", "list_ms_sign_ins", "list_ms_conditional_access", "list_ms_service_principals"],
  "GitHub": ["list_github_repos", "list_github_orgs", "get_github_me", "list_github_gists", "list_org_members", "list_repo_secrets", "list_repo_webhooks"],
  "GitLab": ["list_gitlab_projects", "list_gitlab_groups", "list_gitlab_snippets"],
  "Slack": ["list_slack_channels", "list_slack_users", "list_slack_files"],
  "AWS": ["get_aws_identity", "list_aws_iam_users", "list_aws_iam_roles", "list_aws_s3_buckets", "list_aws_secrets"],
  "GCP": ["list_gcp_buckets"],
}

const TOOLS = Object.values(TOOL_GROUPS).flat()

type TransportMode = "stdio" | "http"

interface McpStatus {
  running: boolean
  pid: number | null
  transport?: string
  port?: number
  host?: string
}

export function MCPSection() {
  const [mode, setMode] = useState<TransportMode>("stdio")
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [depsInstalled, setDepsInstalled] = useState<boolean | null>(null)
  const [port, setPort] = useState(3001)
  const [host, setHost] = useState("127.0.0.1")
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [status, setStatus] = useState<McpStatus>({ running: false, pid: null })

  // Check if mcp-server deps are installed by hitting the health check
  useEffect(() => {
    fetch("/api/mcp/status")
      .then((r) => r.json())
      .then((data) => {
        setDepsInstalled(true)
        setStatus(data)
      })
      .catch(() => setDepsInstalled(false))
  }, [])

  // Poll status when in HTTP mode
  useEffect(() => {
    if (mode !== "http") return
    const check = async () => {
      try {
        const res = await fetch("/api/mcp/status")
        if (res.ok) setStatus(await res.json())
      } catch {
        setStatus({ running: false, pid: null })
      }
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [mode])

  // Detect the project path for the config
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:4000"

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        ninken: {
          command: "node",
          args: ["PATH_TO_NINKEN/mcp-server/index.js"],
          env: { NINKEN_BASE_URL: baseUrl },
        },
      },
    },
    null,
    2
  )

  const installCmd = "cd mcp-server && npm install"
  const activeHost = status.host ?? host
  const activePort = status.port ?? port
  const connectionUrl = `http://${activeHost}:${activePort}/mcp`

  const handleCopyConfig = async () => {
    await navigator.clipboard.writeText(mcpConfig)
    setCopiedConfig(true)
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  const handleCopyInstall = async () => {
    await navigator.clipboard.writeText(installCmd)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(connectionUrl)
    setCopiedUrl(true)
    toast.success("Connection URL copied to clipboard")
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleStart = useCallback(async () => {
    setStarting(true)
    try {
      const res = await fetch("/api/mcp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transport: "http", port, host }),
      })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        toast.success(`MCP server started on ${host}:${port}`)
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to start" }))
        toast.error(err.error || "Failed to start MCP server")
      }
    } catch {
      toast.error("Failed to start MCP server")
    } finally {
      setStarting(false)
    }
  }, [port])

  const handleStop = useCallback(async () => {
    setStopping(true)
    try {
      const res = await fetch("/api/mcp/stop", { method: "POST" })
      if (res.ok) {
        setStatus({ running: false, pid: null })
        toast.success("MCP server stopped")
      } else {
        toast.error("Failed to stop MCP server")
      }
    } catch {
      toast.error("Failed to stop MCP server")
    } finally {
      setStopping(false)
    }
  }, [])

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          MCP Server
        </CardTitle>
        <CardDescription>
          Expose Ninken as {TOOLS.length} MCP tools for Claude Desktop and Claude Code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transport Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          <button
            onClick={() => setMode("stdio")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "stdio"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            STDIO
          </button>
          <button
            onClick={() => setMode("http")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "http"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            HTTP
          </button>
        </div>

        {mode === "stdio" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Claude starts the MCP server automatically via STDIO using the config below.
            </p>

            {/* Step 1: Install */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-mono">Step 1</Badge>
                <p className="text-sm font-medium">Install dependencies</p>
                {depsInstalled === true && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <pre className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 text-xs font-mono">
                  <Terminal className="inline h-3 w-3 mr-1.5 text-muted-foreground" />
                  {installCmd}
                </pre>
                <Button variant="outline" size="sm" onClick={handleCopyInstall}>
                  {copiedInstall ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Step 2: Add config */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-mono">Step 2</Badge>
                <p className="text-sm font-medium">Add to Claude Desktop or <code className="text-xs bg-muted px-1 rounded">.mcp.json</code></p>
              </div>
              <p className="text-xs text-muted-foreground">
                Replace <code>PATH_TO_NINKEN</code> with the absolute path to your Ninken installation.
              </p>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs font-mono leading-relaxed">
                  {mcpConfig}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleCopyConfig}
                >
                  {copiedConfig ? (
                    <><Check className="h-3.5 w-3.5" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy</>
                  )}
                </Button>
              </div>
            </div>

            {/* Step 3: Use */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-mono">Step 3</Badge>
                <p className="text-sm font-medium">Use with Claude</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Claude Desktop and Claude Code will automatically start the MCP server when you use it.
                Ask Claude to &quot;search my Gmail&quot; or &quot;list my GitHub repos&quot; and it will use Ninken&apos;s tools.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* HTTP Mode */}
            <p className="text-xs text-muted-foreground">
              Streamable HTTP transport allows any MCP client to connect. Server binds to localhost only.
            </p>

            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Circle
                  className={cn(
                    "h-3 w-3 fill-current",
                    status.running ? "text-emerald-500" : "text-red-500"
                  )}
                />
                <span className="text-sm font-medium">
                  {status.running
                    ? `Running on ${activeHost}:${activePort}`
                    : "Stopped"}
                </span>
              </div>
              {status.running && status.pid && (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  PID {status.pid}
                </Badge>
              )}
            </div>

            {/* Host + Port + Start/Stop controls */}
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <label htmlFor="mcp-host" className="text-xs font-medium text-muted-foreground">
                  Bind Address
                </label>
                <Input
                  id="mcp-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value || "127.0.0.1")}
                  className="w-32 font-mono text-xs"
                  placeholder="127.0.0.1"
                  disabled={status.running}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="mcp-port" className="text-xs font-medium text-muted-foreground">
                  Port
                </label>
                <Input
                  id="mcp-port"
                  type="number"
                  min={1024}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 3001)}
                  className="w-24 font-mono text-xs"
                  disabled={status.running}
                />
              </div>

              {status.running ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  disabled={stopping}
                  className="gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" />
                  {stopping ? "Stopping..." : "Stop Server"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStart}
                  disabled={starting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Play className="h-3.5 w-3.5" />
                  {starting ? "Starting..." : "Start Server"}
                </Button>
              )}
            </div>

            {/* Connection URL */}
            {status.running && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Connection URL</p>
                <div className="flex items-center gap-2">
                  <pre className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 text-xs font-mono">
                    {connectionUrl}
                  </pre>
                  <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5">
                    {copiedUrl ? (
                      <><Check className="h-3.5 w-3.5" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tools list */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Available Tools ({TOOLS.length})</p>
          {Object.entries(TOOL_GROUPS).map(([group, tools]) => (
            <div key={group} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{group}</p>
              <div className="flex flex-wrap gap-1">
                {tools.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs font-mono">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
