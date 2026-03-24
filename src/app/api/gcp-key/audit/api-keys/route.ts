import { NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized, badRequest } from "@/app/api/_helpers"
import { gcpKeyFetch, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/audit/api-keys
 * Fetches API key restrictions from the API Keys API.
 * This may fail with 403 if the API key doesn't have access to the API Keys API.
 */
export async function GET() {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const project = credential.project_id
  if (!project) return badRequest("Project ID required for API key audit")

  try {
    const data = await gcpKeyFetch<{
      keys?: {
        name: string
        displayName?: string
        restrictions?: {
          browserKeyRestrictions?: unknown
          serverKeyRestrictions?: unknown
          androidKeyRestrictions?: unknown
          iosKeyRestrictions?: unknown
          apiTargets?: { service: string }[]
        }
      }[]
    }>({
      credential,
      url: `https://apikeys.googleapis.com/v2/projects/${project}/locations/global/keys`,
    })

    const keys = (data.keys ?? []).map((k) => ({
      name: k.name,
      displayName: k.displayName ?? null,
      restrictions: k.restrictions ?? null,
      hasApplicationRestrictions: !!(
        k.restrictions?.browserKeyRestrictions ||
        k.restrictions?.serverKeyRestrictions ||
        k.restrictions?.androidKeyRestrictions ||
        k.restrictions?.iosKeyRestrictions
      ),
      hasApiRestrictions: !!(k.restrictions?.apiTargets && k.restrictions.apiTargets.length > 0),
      apiTargets: k.restrictions?.apiTargets?.map((t) => t.service) ?? [],
    }))

    return NextResponse.json({
      keys,
      totalCount: keys.length,
      unrestrictedCount: keys.filter((k) => !k.hasApplicationRestrictions && !k.hasApiRestrictions).length,
    })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    if (parsed.status === 403) {
      return NextResponse.json({
        keys: [],
        unavailable: true,
        message: "API Keys API is not accessible with this key. The key may lack apikeys.googleapis.com access.",
        totalCount: 0,
        unrestrictedCount: 0,
      })
    }
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
