import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubJson } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubWorkflow = {
  id: number
  name: string
  path: string
  state: string
  created_at: string
  updated_at: string
  html_url: string
}

type WorkflowsResponse = {
  total_count: number
  workflows: GitHubWorkflow[]
}

/**
 * GET /api/github/repos/[owner]/[repo]/actions/workflows
 * Lists workflows for a repository.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { owner, repo } = await params

    const { data } = await githubJson<WorkflowsResponse>(
      token,
      `/repos/${owner}/${repo}/actions/workflows`
    )

    return NextResponse.json({
      workflows: data.workflows.map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state,
        htmlUrl: w.html_url,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      })),
      totalCount: data.total_count,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
