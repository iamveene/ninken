import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubBranch = {
  name: string
  protected: boolean
  protection?: {
    enabled: boolean
    required_status_checks?: {
      enforcement_level: string
      contexts: string[]
    }
  }
  protection_url?: string
}

/**
 * GET /api/github/repos/[owner]/[repo]/branches
 * Lists branches and their protection status for a repository.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { owner, repo } = await params

    const branches = await githubPaginateAll<GitHubBranch>(
      token,
      `/repos/${owner}/${repo}/branches`,
      { perPage: 100, maxPages: 3 }
    )

    return NextResponse.json({
      branches: branches.map((b) => ({
        name: b.name,
        protected: b.protected,
        protectionEnabled: b.protection?.enabled ?? false,
      })),
      totalCount: branches.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
