import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubCollaborator = {
  login: string
  id: number
  avatar_url: string
  html_url: string
  type: string
  site_admin: boolean
  permissions?: { admin: boolean; maintain: boolean; push: boolean; triage: boolean; pull: boolean }
  role_name?: string
}

/**
 * GET /api/github/repos/[owner]/[repo]/collaborators
 * Lists collaborators for a repository.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { owner, repo } = await params

    const collaborators = await githubPaginateAll<GitHubCollaborator>(
      token,
      `/repos/${owner}/${repo}/collaborators`,
      { perPage: 100, maxPages: 5 }
    )

    return NextResponse.json({
      collaborators: collaborators.map((c) => ({
        login: c.login,
        id: c.id,
        avatarUrl: c.avatar_url,
        htmlUrl: c.html_url,
        type: c.type,
        siteAdmin: c.site_admin,
        permissions: c.permissions ?? null,
        roleName: c.role_name ?? null,
      })),
      totalCount: collaborators.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
