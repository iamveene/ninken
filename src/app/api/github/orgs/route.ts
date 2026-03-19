import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubOrg = {
  login: string
  id: number
  description: string | null
  avatar_url: string
  url: string
}

/**
 * GET /api/github/orgs
 * Lists organizations for the authenticated user.
 */
export async function GET() {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const orgs = await githubPaginateAll<GitHubOrg>(token, "/user/orgs", {
      perPage: 100,
      maxPages: 5,
    })

    return NextResponse.json({
      orgs: orgs.map((o) => ({
        login: o.login,
        id: o.id,
        description: o.description,
        avatarUrl: o.avatar_url,
      })),
      totalCount: orgs.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
