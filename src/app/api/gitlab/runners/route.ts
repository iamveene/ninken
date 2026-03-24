import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabRunnerResponse = {
  id: number
  description: string
  ip_address: string | null
  active: boolean
  paused: boolean
  is_shared: boolean
  runner_type: string
  name: string | null
  online: boolean
  status: string
  tag_list: string[]
}

/**
 * GET /api/gitlab/runners
 * Returns runners accessible to the authenticated user.
 */
export async function GET() {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  try {
    const raw = await gitlabPaginateAll<GitLabRunnerResponse>(
      token,
      `/runners`,
      { perPage: 100, maxPages: 5 }
    )

    const runners = raw.map((r) => ({
      id: r.id,
      description: r.description,
      ipAddress: r.ip_address,
      active: r.active,
      paused: r.paused,
      isShared: r.is_shared,
      runnerType: r.runner_type,
      name: r.name,
      online: r.online,
      status: r.status,
      tagList: r.tag_list ?? [],
    }))

    return NextResponse.json({ runners })
  } catch (error) {
    const err = error as { status?: number }
    if (err.status === 403) {
      return NextResponse.json({ runners: [] })
    }
    return serverError(error, "gitlab")
  }
}
