import { NextRequest, NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/compute/instances
 * Lists VM instances across all zones (aggregated).
 */
export async function GET(req: NextRequest) {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = req.nextUrl.searchParams.get("project") ?? credential.project_id
  if (!project) return badRequest("Project ID required")

  try {
    const data = await gcpKeyFetch<{
      items?: Record<string, { instances?: unknown[] }>
    }>({
      credential,
      url: `https://compute.googleapis.com/compute/v1/projects/${project}/aggregated/instances`,
    })

    // Flatten aggregated response: { "zones/us-central1-a": { instances: [...] }, ... }
    const instances: unknown[] = []
    if (data.items) {
      for (const [zone, zoneData] of Object.entries(data.items)) {
        if (zoneData.instances) {
          for (const inst of zoneData.instances) {
            instances.push({ ...(inst as Record<string, unknown>), _zone: zone.replace("zones/", "") })
          }
        }
      }
    }

    return NextResponse.json({ instances })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
