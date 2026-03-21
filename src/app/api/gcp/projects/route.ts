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

          // Probe how many buckets have visible objects
          let withObjectsCount = 0
          const probes = await Promise.allSettled(
            buckets.map(async (b) => {
              try {
                const objRes = await storage.objects.list({ bucket: b.name!, maxResults: 1, delimiter: "/" })
                const hasItems = (objRes.data.items?.length ?? 0) > 0
                const hasPrefixes = (objRes.data.prefixes?.length ?? 0) > 0
                return hasItems || hasPrefixes
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
    return serverError(error, "google")
  }
}
