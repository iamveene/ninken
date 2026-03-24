import { readFileSync, existsSync, unlinkSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export const dynamic = "force-dynamic"

const MCP_DIR = join(homedir(), ".ninken-mcp")
const PID_FILE = join(MCP_DIR, "server.pid")
const STATE_FILE = join(MCP_DIR, "server.json")

/**
 * POST /api/mcp/stop — Stop the running MCP server
 * Reads PID file, sends SIGTERM, cleans up PID file and state file.
 */
export async function POST() {
  try {
    if (!existsSync(PID_FILE)) {
      // Clean up stale state file if PID file is already gone
      try { unlinkSync(STATE_FILE) } catch {}
      return Response.json({ running: false })
    }

    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
    if (isNaN(pid)) {
      try { unlinkSync(PID_FILE) } catch {}
      try { unlinkSync(STATE_FILE) } catch {}
      return Response.json({ running: false })
    }

    // Try graceful shutdown first
    try {
      process.kill(pid, 0) // Check alive
      process.kill(pid, "SIGTERM")

      // Wait up to 2s for graceful shutdown
      const deadline = Date.now() + 2000
      let alive = true
      while (Date.now() < deadline && alive) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        try {
          process.kill(pid, 0)
        } catch {
          alive = false
        }
      }

      // Force kill if still alive
      if (alive) {
        try { process.kill(pid, "SIGKILL") } catch {}
      }
    } catch {
      // Process already dead
    }

    // Clean up PID file and state file
    try { unlinkSync(PID_FILE) } catch {}
    try { unlinkSync(STATE_FILE) } catch {}

    return Response.json({ running: false })
  } catch {
    return Response.json({ running: false })
  }
}
