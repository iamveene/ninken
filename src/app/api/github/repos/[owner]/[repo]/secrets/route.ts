import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubJson } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubSecretsResponse = {
  total_count: number
  secrets: {
    name: string
    created_at: string
    updated_at: string
  }[]
}

/**
 * GET /api/github/repos/[owner]/[repo]/secrets
 * Lists Actions secrets for a repository.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { owner, repo } = await params

    const { data } = await githubJson<GitHubSecretsResponse>(
      token,
      `/repos/${owner}/${repo}/actions/secrets`
    )

    return NextResponse.json({
      secrets: data.secrets.map((s) => ({
        name: s.name,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      totalCount: data.total_count,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
