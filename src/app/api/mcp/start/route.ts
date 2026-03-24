import { exec } from "child_process"
import { join } from "path"
import { readFileSync, existsSync } from "fs"
import { homedir } from "os"

export const dynamic = "force-dynamic"

const MCP_DIR = join(homedir(), ".ninken-mcp")
const PID_FILE = join(MCP_DIR, "server.pid")
const STATE_FILE = join(MCP_DIR, "server.json")

function isRunning(): number | null {
  try {
    if (!existsSync(PID_FILE)) return null
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
    if (isNaN(pid)) return null
    process.kill(pid, 0)
    return pid
  } catch {
    return null
  }
}

function readState(): { pid?: number; transport?: string; port?: number; host?: string } {
  try {
    if (!existsSync(STATE_FILE)) return {}
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
  } catch {
    return {}
  }
}

/**
 * POST /api/mcp/start — Spawn the MCP server as a detached child process.
 * Uses exec() with nohup to fully detach from the Next.js process tree.
 * The MCP server writes its own PID file on startup.
 *
 * Accepts optional body fields:
 *   - cookie: string — auth cookie for Ninken API
 *   - baseUrl: string — Ninken API base URL
 *   - transport: "stdio" | "http" — transport mode (default: "stdio")
 *   - port: number — HTTP port when transport is "http" (default: 3001)
 */
export async function POST(req: Request) {
  try {
    // Check if already running
    const existingPid = isRunning()
    if (existingPid) {
      const state = readState()
      return Response.json({
        running: true,
        pid: existingPid,
        transport: state.transport || "stdio",
        port: state.port || null,
        message: "Already running",
      })
    }

    // Parse optional env overrides and transport config from body
    let cookie = ""
    let baseUrl = "http://localhost:4000"
    let transport: "stdio" | "http" = "stdio"
    let port = 3001
    let host = "127.0.0.1"
    try {
      const body = await req.json()
      if (body.cookie) cookie = body.cookie
      if (body.baseUrl) baseUrl = body.baseUrl
      if (body.transport === "http") transport = "http"
      if (typeof body.port === "number" && body.port > 0) port = body.port
      if (body.host && typeof body.host === "string") host = body.host
    } catch {
      // Empty body is fine — use defaults
    }

    // Build the server path at runtime — opaque to Turbopack's static analysis
    const cwd = process.cwd()
    const serverScript = [cwd, "mcp-server", "index.js"].join("/")

    // Build env string for the shell command
    const envParts = [`NINKEN_BASE_URL=${JSON.stringify(baseUrl)}`]
    if (cookie) {
      envParts.push(`NINKEN_COOKIE=${JSON.stringify(cookie)}`)
    }

    // Build transport flags
    const transportFlags = transport === "http"
      ? ` --transport http --port ${port} --host ${host}`
      : ""

    // Use nohup + & to fully detach the process from the Next.js process tree.
    // Redirect stdout/stderr to /dev/null so the parent can exit cleanly.
    const cmd = `${envParts.join(" ")} nohup node ${JSON.stringify(serverScript)}${transportFlags} > /dev/null 2>&1 &`

    await new Promise<void>((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // Wait for the PID file to be written by the child process
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Read the PID that the server wrote
    const newPid = isRunning()
    const state = readState()

    return Response.json({
      running: !!newPid,
      pid: newPid,
      transport: state.transport || transport,
      port: transport === "http" ? (state.port || port) : null,
      host: transport === "http" ? (state.host || host) : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start MCP server"
    return Response.json({ running: false, pid: null, error: message }, { status: 500 })
  }
}
