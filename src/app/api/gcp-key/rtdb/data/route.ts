import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/rtdb/data
 * Reads data at a path from a Firebase RTDB instance.
 * Query params: instance, path (default: /)
 *
 * Note: RTDB uses instance-specific URLs with the API key as a query param,
 * not the standard gcpKeyFetch pattern.
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const instance = req.nextUrl.searchParams.get("instance")
  if (!instance) return badRequest("Instance name required")

  const path = req.nextUrl.searchParams.get("path") ?? "/"
  const cleanPath = path.startsWith("/") ? path.slice(1) : path

  try {
    const url = `https://${instance}.firebaseio.com/${cleanPath}.json?key=${credential.api_key}`
    const res = await fetch(url)

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({
        error: res.statusText,
      }))
      return NextResponse.json(
        { error: errBody?.error ?? res.statusText },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json({ data })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
