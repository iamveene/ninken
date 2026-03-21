import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/firestore/databases
 * Lists Firestore databases for the project.
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = req.nextUrl.searchParams.get("project") ?? credential.project_id
  if (!project) return badRequest("Project ID required")

  try {
    const data = await gcpKeyFetch<{ databases?: unknown[] }>({
      credential,
      url: `https://firestore.googleapis.com/v1/projects/${project}/databases`,
    })
    return NextResponse.json({ databases: data.databases ?? [] })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
