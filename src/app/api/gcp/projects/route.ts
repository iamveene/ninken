import { NextResponse } from "next/server"
import { createResourceManagerServiceFromToken, createStorageServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const crm = createResourceManagerServiceFromToken(accessToken)
    const res = await crm.projects.search()
    const allProjects = res.data.projects || []

    const storage = createStorageServiceFromToken(accessToken)
    const accessChecks = await Promise.allSettled(
      allProjects.map(async (project) => {
        const projectId = project.projectId
        if (!projectId) return { project, accessible: false, bucketCount: 0 }
        try {
          const bucketsRes = await storage.buckets.list({ project: projectId })
          const buckets = bucketsRes.data.items ?? []
          const bucketCount = buckets.length

          // Probe how many buckets have downloadable objects (readable + downloadable + has content)
          let withObjectsCount = 0
          const probes = await Promise.allSettled(
            buckets.map(async (b) => {
              try {
                const objRes = await storage.objects.list({ bucket: b.name!, maxResults: 1, delimiter: "/" })
                const items = objRes.data.items ?? []
                const prefixes = objRes.data.prefixes ?? []
                if (items.length === 0 && prefixes.length === 0) return false
                // Check download access on first object if available
                if (items.length > 0) {
                  try {
                    await storage.objects.get({ bucket: b.name!, object: items[0].name! })
                  } catch {
                    return false // Can list but not download — not truly accessible
                  }
                }
                return true
              } catch {
                return false
              }
            })
          )
          for (const p of probes) {
            if (p.status === "fulfilled" && p.value) withObjectsCount++
          }

          return { project, accessible: true, bucketCount, withObjectsCount }
        } catch {
          return { project, accessible: false, bucketCount: 0, withObjectsCount: 0 }
        }
      })
    )

    const enriched = accessChecks
      .map((result) => {
        if (result.status !== "fulfilled" || !result.value) return null
        const { project, accessible, bucketCount, withObjectsCount } = result.value
        return {
          projectId: project.projectId,
          name: project.name,
          displayName: project.displayName,
          state: project.state,
          accessible,
          bucketCount,
          withObjectsCount,
        }
      })
      .filter(Boolean)

    // Sort: projects with visible data first, then accessible but empty, then inaccessible
    enriched.sort((a, b) => {
      if (!a || !b) return 0
      if (a.accessible && !b.accessible) return -1
      if (!a.accessible && b.accessible) return 1
      // Within accessible: projects with buckets containing objects first
      const aData = a.withObjectsCount ?? 0
      const bData = b.withObjectsCount ?? 0
      if (aData > 0 && bData === 0) return -1
      if (aData === 0 && bData > 0) return 1
      if (aData !== bData) return bData - aData
      // Then by bucket count, then alphabetical
      if (a.bucketCount > 0 && b.bucketCount === 0) return -1
      if (a.bucketCount === 0 && b.bucketCount > 0) return 1
      return (a.displayName || a.projectId || "").localeCompare(b.displayName || b.projectId || "")
    })

    return NextResponse.json({ projects: enriched })
  } catch (error) {
    return serverError(error, "gcp")
  }
}
