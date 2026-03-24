import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubDeployKey = {
  id: number
  key: string
  title: string
  url: string
  verified: boolean
  read_only: boolean
  created_at: string
}

/**
 * GET /api/github/repos/[owner]/[repo]/deploy-keys
 * Lists deploy keys for a repository.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { owner, repo } = await params

    const keys = await githubPaginateAll<GitHubDeployKey>(
      token,
      `/repos/${owner}/${repo}/keys`,
      { perPage: 100, maxPages: 3 }
    )

    return NextResponse.json({
      deployKeys: keys.map((k) => ({
        id: k.id,
        title: k.title,
        key: k.key,
        verified: k.verified,
        readOnly: k.read_only,
        createdAt: k.created_at,
      })),
      totalCount: keys.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
