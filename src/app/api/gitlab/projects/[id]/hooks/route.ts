import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabHookResponse = {
  id: number
  url: string
  project_id: number
  push_events: boolean
  merge_requests_events: boolean
  tag_push_events: boolean
  issues_events: boolean
  note_events: boolean
  pipeline_events: boolean
  job_events: boolean
  enable_ssl_verification: boolean
  created_at: string
}

/**
 * GET /api/gitlab/projects/[id]/hooks
 * Returns webhooks configured for a given project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params

  try {
    const raw = await gitlabPaginateAll<GitLabHookResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/hooks`,
      { perPage: 100, maxPages: 3 }
    )

    const hooks = raw.map((h) => ({
      id: h.id,
      url: h.url,
      projectId: h.project_id,
      pushEvents: h.push_events,
      mergeRequestsEvents: h.merge_requests_events,
      tagPushEvents: h.tag_push_events,
      issuesEvents: h.issues_events,
      pipelineEvents: h.pipeline_events,
      enableSslVerification: h.enable_ssl_verification,
      createdAt: h.created_at,
    }))

    return NextResponse.json({ hooks })
  } catch (error) {
    const err = error as { status?: number }
    if (err.status === 403 || err.status === 404) {
      return NextResponse.json({ hooks: [] })
    }
    return serverError(error, "gitlab")
  }
}
