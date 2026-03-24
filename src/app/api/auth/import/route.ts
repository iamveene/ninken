import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Pending import store — holds tokens deposited by NinLoader CLI
 * until the browser picks them up via GET + ?code=.
 *
 * Entries expire after 5 minutes (one-time use, short-lived).
 */
type PendingImport = {
  payload: unknown
  createdAt: number
}

const pending = new Map<string, PendingImport>()
const IMPORT_TTL_MS = 5 * 60 * 1000 // 5 minutes

function cleanup() {
  const now = Date.now()
  for (const [code, entry] of pending) {
    if (now - entry.createdAt > IMPORT_TTL_MS) {
      pending.delete(code)
    }
  }
}

/**
 * POST /api/auth/import
 *
 * Called by NinLoader CLI.  Stores the token payload server-side with a
 * random code and returns an import URL the operator can open in the
 * browser to complete the import (IndexedDB + cookie).
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 })
  }

  cleanup()

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  pending.set(code, { payload: body, createdAt: Date.now() })

  // Build the import URL from the request origin
  const origin = request.headers.get("origin")
    || request.headers.get("referer")?.replace(/\/api\/.*$/, "")
    || `http://localhost:${process.env.PORT || 4000}`

  const importUrl = `${origin}/?import=${code}`

  return NextResponse.json({
    code,
    importUrl,
    expiresIn: "5 minutes",
    hint: "Open the URL in your browser to complete the import",
  })
}

/**
 * GET /api/auth/import?code=XXX
 *
 * Called by the browser landing page to retrieve a pending import.
 * One-time use — the entry is deleted after retrieval.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 })
  }

  cleanup()

  const entry = pending.get(code)
  if (!entry) {
    return NextResponse.json({ error: "Import code not found or expired" }, { status: 404 })
  }

  // One-time use — delete after retrieval
  pending.delete(code)

  return NextResponse.json({ payload: entry.payload })
}
