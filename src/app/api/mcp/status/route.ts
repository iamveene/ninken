import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export const dynamic = "force-dynamic"

const MCP_DIR = join(homedir(), ".ninken-mcp")
const PID_FILE = join(MCP_DIR, "server.pid")
const STATE_FILE = join(MCP_DIR, "server.json")

function readState(): { pid?: number; transport?: string; port?: number; host?: string } {
  try {
    if (!existsSync(STATE_FILE)) return {}
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
  } catch {
    return {}
  }
}

/**
 * GET /api/mcp/status — Check if the MCP server is running
 * Reads the PID file and checks if the process is alive via kill(pid, 0).
 * Also reads server.json for transport mode and port information.
 */
export async function GET() {
  try {
    if (!existsSync(PID_FILE)) {
      return Response.json({ running: false, pid: null, transport: null, port: null, host: null })
    }

    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
    if (isNaN(pid)) {
      return Response.json({ running: false, pid: null, transport: null, port: null, host: null })
    }

    // Check if process is alive (kill with signal 0 tests existence)
    try {
      process.kill(pid, 0)
      const state = readState()
      return Response.json({
        running: true,
        pid,
        transport: state.transport || "stdio",
        port: state.port || null,
        host: state.host || null,
      })
    } catch {
      // Process not found — stale PID file
      return Response.json({ running: false, pid: null, transport: null, port: null, host: null })
    }
  } catch {
    return Response.json({ running: false, pid: null, transport: null, port: null })
  }
}
