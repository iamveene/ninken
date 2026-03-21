import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubJson } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubRunner = {
  id: number
  name: string
  os: string
  status: string
  busy: boolean
  labels: { id: number; name: string; type: string }[]
}

type RunnersResponse = {
  total_count: number
  runners: GitHubRunner[]
}

/**
 * GET /api/github/repos/[owner]/[repo]/actions/runners
 * Lists self-hosted runners for a repository.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { owner, repo } = await params

    const { data } = await githubJson<RunnersResponse>(
      token,
      `/repos/${owner}/${repo}/actions/runners`
    )

    return NextResponse.json({
      runners: data.runners.map((r) => ({
        id: r.id,
        name: r.name,
        os: r.os,
        status: r.status,
        busy: r.busy,
        labels: r.labels.map((l) => l.name),
      })),
      totalCount: data.total_count,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
