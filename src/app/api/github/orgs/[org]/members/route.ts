import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubMember = {
  login: string
  id: number
  avatar_url: string
  html_url: string
  type: string
  site_admin: boolean
}

/**
 * GET /api/github/orgs/[org]/members
 * Lists members of an organization.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ org: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { org } = await params
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") || "all"

    const members = await githubPaginateAll<GitHubMember>(
      token,
      `/orgs/${org}/members`,
      {
        params: { role },
        perPage: 100,
        maxPages: 5,
      }
    )

    return NextResponse.json({
      members: members.map((m) => ({
        login: m.login,
        id: m.id,
        avatarUrl: m.avatar_url,
        htmlUrl: m.html_url,
        type: m.type,
        siteAdmin: m.site_admin,
      })),
      totalCount: members.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
