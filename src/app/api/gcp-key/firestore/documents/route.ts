import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/firestore/documents
 * Lists documents in a Firestore collection.
 * Query params: project, database, collection, pageSize, pageToken
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = req.nextUrl.searchParams.get("project") ?? credential.project_id
  if (!project) return badRequest("Project ID required")

  const database = req.nextUrl.searchParams.get("database") ?? "(default)"
  const collection = req.nextUrl.searchParams.get("collection")
  if (!collection) return badRequest("Collection path required")

  const pageSize = req.nextUrl.searchParams.get("pageSize") ?? "50"
  const pageToken = req.nextUrl.searchParams.get("pageToken")

  try {
    const params: Record<string, string> = { pageSize }
    if (pageToken) params.pageToken = pageToken

    const data = await gcpKeyFetch<{ documents?: unknown[]; nextPageToken?: string }>({
      credential,
      url: `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/${collection}`,
      params,
    })
    return NextResponse.json({
      documents: data.documents ?? [],
      nextPageToken: data.nextPageToken ?? null,
    })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
