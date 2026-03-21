import { NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized } from "@/app/api/_helpers"
import { probeGcpApi, parseGcpKeyError } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/me
 * Probes the API key to discover which GCP APIs are enabled.
 * Returns { projectId, enabledApis, keyPrefix }.
 */
export async function GET() {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const key = credential.api_key
  const keyPrefix = key.slice(0, 12) + "..."

  const probes: { scope: string; url: string }[] = [
    {
      scope: "firestore.googleapis.com",
      url: "https://firestore.googleapis.com/v1/projects/-/databases",
    },
    {
      scope: "firebaseio.com",
      url: "https://firebasedatabase.googleapis.com/v1beta/projects/-/instances",
    },
    {
      scope: "storage.googleapis.com",
      url: "https://storage.googleapis.com/storage/v1/b?project=_",
    },
    {
      scope: "compute.googleapis.com",
      url: "https://compute.googleapis.com/compute/v1/projects/-/zones",
    },
    {
      scope: "aiplatform.googleapis.com",
      url: "https://us-central1-aiplatform.googleapis.com/v1/projects/-/locations/us-central1/models",
    },
  ]

  try {
    const results = await Promise.allSettled(
      probes.map(async (p) => {
        const ok = await probeGcpApi(p.url, key)
        return ok ? p.scope : null
      }),
    )

    const enabledApis = results
      .filter(
        (r): r is PromiseFulfilledResult<string> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value)

    return NextResponse.json({
      projectId: credential.project_id ?? null,
      enabledApis,
      keyPrefix,
    })
  } catch (err) {
    const parsed = parseGcpKeyError(err)
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }
}
