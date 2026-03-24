import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/firestore/collections
 * Lists root collection IDs for a Firestore database.
 * Uses POST to the :listCollectionIds endpoint (required by GCP API).
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = req.nextUrl.searchParams.get("project") ?? credential.project_id
  if (!project) return badRequest("Project ID required")

  const database = req.nextUrl.searchParams.get("database") ?? "(default)"

  try {
    const data = await gcpKeyFetch<{ collectionIds?: string[] }>({
      credential,
      url: `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents:listCollectionIds`,
      method: "POST",
      body: {},
    })
    return NextResponse.json({ collectionIds: data.collectionIds ?? [] })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
