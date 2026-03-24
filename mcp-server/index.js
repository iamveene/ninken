#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import http from "node:http"
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { registerTools, setCredentialCallback } from "./tools.js"

const BASE_URL = process.env.NINKEN_BASE_URL || "http://localhost:4000"
let activeCookie = process.env.NINKEN_COOKIE || ""
const PID_DIR = join(homedir(), ".ninken-mcp")
const PID_FILE = join(PID_DIR, "server.pid")
const STATE_FILE = join(PID_DIR, "server.json")

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2)
  let transport = "stdio"
  let port = 3001
  let host = "127.0.0.1"

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--transport" && args[i + 1]) {
      transport = args[i + 1]
      i++
    } else if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1], 10)
      if (isNaN(port)) port = 3001
      i++
    } else if (args[i] === "--host" && args[i + 1]) {
      host = args[i + 1]
      i++
    }
  }

  return { transport, port, host }
}

// Kill stale server from a previous session
function killStaleServer() {
  try {
    if (!existsSync(PID_FILE)) return
    const oldPid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
    if (isNaN(oldPid) || oldPid === process.pid) return
    process.kill(oldPid, 0) // check if alive
    process.kill(oldPid, "SIGTERM")
    // Wait briefly for graceful shutdown
    const deadline = Date.now() + 2000
    while (Date.now() < deadline) {
      try { process.kill(oldPid, 0) } catch { break }
      const wait = Date.now() + 50
      while (Date.now() < wait) { /* spin */ }
    }
    try { process.kill(oldPid, "SIGKILL") } catch {}
  } catch {}
}

// Write PID file
function writePid() {
  mkdirSync(PID_DIR, { recursive: true })
  writeFileSync(PID_FILE, String(process.pid), { mode: 0o600 })
}

// Write state file with transport metadata
function writeState(transportMode, port, host) {
  mkdirSync(PID_DIR, { recursive: true })
  const state = { pid: process.pid, transport: transportMode, port, host }
  writeFileSync(STATE_FILE, JSON.stringify(state), { mode: 0o600 })
}

function removePid() {
  try { unlinkSync(PID_FILE) } catch {}
}

function removeState() {
  try { unlinkSync(STATE_FILE) } catch {}
}

function cleanup() {
  removePid()
  removeState()
}

// HTTP helper to call Ninken API
async function ninkenAPI(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    "Content-Type": "application/json",
    ...(activeCookie ? { Cookie: `ninken_token=${activeCookie}` } : {}),
    ...options.headers,
  }

  const res = await fetch(url, { ...options, headers })

  // Capture Set-Cookie from auth endpoints to update active credential
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) {
    const match = setCookie.match(/ninken_token=([^;]+)/)
    if (match) {
      activeCookie = match[1]
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Ninken API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// Start with STDIO transport (original behavior)
async function startStdio(server) {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error("[ninken-mcp] Transport: stdio")

  process.on("SIGINT", () => { cleanup(); process.exit(0) })
  process.on("SIGTERM", () => { cleanup(); process.exit(0) })
  process.stdin.on("end", () => { cleanup(); process.exit(0) })
}

// Start with Streamable HTTP transport (stateless — fresh server per request)
async function startHttp(port, host) {
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`)

    // Only handle /mcp path
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Not found" }))
      return
    }

    // Handle POST, GET, DELETE for MCP protocol
    if (req.method === "POST" || req.method === "GET" || req.method === "DELETE") {
      try {
        // Stateless mode: create a fresh McpServer + transport per request
        // because McpServer.connect() can only be called once per instance
        const reqServer = new McpServer({ name: "ninken-mcp", version: "0.5.0" })
        registerTools(reqServer, ninkenAPI)
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        await reqServer.connect(transport)
        await transport.handleRequest(req, res)
        await reqServer.close()
      } catch (err) {
        console.error("[ninken-mcp] Request error:", err)
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Internal server error" }))
        }
      }
    } else {
      res.writeHead(405, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Method not allowed" }))
    }
  })

  httpServer.listen(port, host, () => {
    console.error(`[ninken-mcp] Transport: http | Port: ${port} | Bound to ${host}`)
  })

  const shutdown = () => {
    httpServer.close()
    cleanup()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

// Main
async function main() {
  const { transport: transportMode, port, host } = parseArgs()

  killStaleServer()
  writePid()
  writeState(transportMode, port, host)

  // Wire credential injection callback so tools can update the active cookie
  setCredentialCallback((cookie) => { activeCookie = cookie })

  if (transportMode === "http") {
    await startHttp(port, host)
  } else {
    const server = new McpServer({ name: "ninken-mcp", version: "0.5.0" })
    registerTools(server, ninkenAPI)
    await startStdio(server)
  }
}

main().catch((err) => {
  console.error("Ninken MCP server failed to start:", err)
  process.exit(1)
})
