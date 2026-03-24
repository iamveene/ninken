import { NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import { analyzeFirewallRules } from "@/lib/gcp-audit"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/audit/firewall
 * Fetches all GCP firewall rules and analyzes them for dangerous configurations.
 */
export async function GET() {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = credential.project_id
  if (!project) return badRequest("Project ID required for firewall audit")

  try {
    const data = await gcpKeyFetch<{
      items?: {
        name: string
        network: string
        direction: string
        sourceRanges?: string[]
        allowed?: { IPProtocol: string; ports?: string[] }[]
        denied?: { IPProtocol: string; ports?: string[] }[]
      }[]
    }>({
      credential,
      url: `https://compute.googleapis.com/compute/v1/projects/${project}/global/firewalls`,
    })

    const rawRules = data.items ?? []
    const rules = analyzeFirewallRules(rawRules)

    return NextResponse.json({
      rules,
      totalCount: rules.length,
      openToWorldCount: rules.filter((r) => r.isOpenToWorld).length,
    })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
