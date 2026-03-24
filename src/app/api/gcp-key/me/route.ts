import { NextResponse } from "next/server"
import { getGcpApiKeyCredential, unauthorized } from "@/app/api/_helpers"
import { probeGcpApi } from "@/lib/gcp-key"
import "@/lib/providers"

export const dynamic = "force-dynamic"

/**
 * GET /api/gcp-key/me
 * Probes the API key to discover project ID and which GCP APIs are enabled.
 * Auto-discovers project via Firebase Management API when possible.
 */
export async function GET() {
  const credential = await getGcpApiKeyCredential()
  if (!credential) return unauthorized()

  const key = credential.api_key
  const keyPrefix = key.slice(0, 12) + "..."

  // Attempt project discovery via Firebase Management API
  let discoveredProjectId: string | null = credential.project_id ?? null

  if (!discoveredProjectId) {
    try {
      const fbRes = await fetch(
        `https://firebase.googleapis.com/v1beta1/projects?key=${key}`,
      )
      if (fbRes.ok) {
        const fbData = await fbRes.json()
        const projects = fbData.results ?? []
        if (projects.length > 0) {
          // Extract project ID from resource name: "projects/my-project-123"
          const resourceName = projects[0].projectId ?? projects[0].project_id
          if (resourceName) discoveredProjectId = resourceName
        }
      }
    } catch {
      // Firebase Management API not available — continue without project
    }
  }

  const projectPath = discoveredProjectId ?? "-"

  const probes: { scope: string; url: string }[] = [
    {
      scope: "firestore.googleapis.com",
      url: `https://firestore.googleapis.com/v1/projects/${projectPath}/databases`,
    },
    {
      scope: "firebaseio.com",
      url: `https://firebasedatabase.googleapis.com/v1beta/projects/${projectPath}/instances`,
    },
    {
      scope: "storage.googleapis.com",
      url: discoveredProjectId
        ? `https://storage.googleapis.com/storage/v1/b?project=${discoveredProjectId}`
        : "https://storage.googleapis.com/storage/v1/b?project=_",
    },
    {
      scope: "compute.googleapis.com",
      url: `https://compute.googleapis.com/compute/v1/projects/${projectPath}/zones`,
    },
    {
      scope: "aiplatform.googleapis.com",
      url: `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectPath}/locations/us-central1/models`,
    },
  ]

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
    projectId: discoveredProjectId,
    enabledApis,
    keyPrefix,
  })
}
