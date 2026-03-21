import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/storage/objects
 * Lists objects in a GCS bucket.
 * Query params: bucket, prefix, maxResults, pageToken
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const bucket = req.nextUrl.searchParams.get("bucket")
  if (!bucket) return badRequest("Bucket name required")

  const prefix = req.nextUrl.searchParams.get("prefix") ?? ""
  const maxResults = req.nextUrl.searchParams.get("maxResults") ?? "100"
  const pageToken = req.nextUrl.searchParams.get("pageToken")

  try {
    const params: Record<string, string> = {
      maxResults,
      delimiter: "/",
    }
    if (prefix) params.prefix = prefix
    if (pageToken) params.pageToken = pageToken

    const data = await gcpKeyFetch<{
      items?: unknown[]
      prefixes?: string[]
      nextPageToken?: string
    }>({
      credential,
      url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`,
      params,
    })

    return NextResponse.json({
      objects: data.items ?? [],
      prefixes: data.prefixes ?? [],
      nextPageToken: data.nextPageToken ?? null,
    })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
