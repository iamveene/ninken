import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/vertexai/endpoints
 * Lists Vertex AI endpoints in a project/region.
 * Query params: project, region (default: us-central1)
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = req.nextUrl.searchParams.get("project") ?? credential.project_id
  if (!project) return badRequest("Project ID required")

  const region = req.nextUrl.searchParams.get("region") ?? "us-central1"

  try {
    const data = await gcpKeyFetch<{ endpoints?: unknown[] }>({
      credential,
      url: `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/endpoints`,
    })
    return NextResponse.json({ endpoints: data.endpoints ?? [] })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
