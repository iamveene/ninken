import { NextResponse } from "next/server"
import { createResourceManagerService, createStorageService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const crm = createResourceManagerService(token)
    const res = await crm.projects.search()
    const allProjects = res.data.projects || []

    const storage = createStorageService(token)
    const accessChecks = await Promise.allSettled(
      allProjects.map(async (project) => {
        const projectId = project.projectId
        if (!projectId) return { project, accessible: false, bucketCount: 0 }
        try {
          const bucketsRes = await storage.buckets.list({ project: projectId })
          const bucketCount = bucketsRes.data.items?.length ?? 0
          return { project, accessible: true, bucketCount }
        } catch {
          return { project, accessible: false, bucketCount: 0 }
        }
      })
    )

    const enriched = accessChecks
      .map((result) => {
        if (result.status !== "fulfilled" || !result.value) return null
        const { project, accessible, bucketCount } = result.value
        return {
          projectId: project.projectId,
          name: project.name,
          displayName: project.displayName,
          state: project.state,
          accessible,
          bucketCount,
        }
      })
      .filter(Boolean)

    // Sort: accessible with buckets first, then accessible empty, then inaccessible
    enriched.sort((a, b) => {
      if (!a || !b) return 0
      if (a.accessible && !b.accessible) return -1
      if (!a.accessible && b.accessible) return 1
      if (a.bucketCount > 0 && b.bucketCount === 0) return -1
      if (a.bucketCount === 0 && b.bucketCount > 0) return 1
      return (a.displayName || a.projectId || "").localeCompare(b.displayName || b.projectId || "")
    })

    return NextResponse.json({ projects: enriched })
  } catch (error) {
    return serverError(error)
  }
}
