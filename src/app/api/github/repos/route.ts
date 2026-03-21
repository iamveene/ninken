import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubRepo = {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  fork: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  default_branch: string
  archived: boolean
  disabled: boolean
  visibility: string
  pushed_at: string | null
  updated_at: string
  created_at: string
  owner: { login: string; avatar_url: string }
  permissions?: { admin: boolean; push: boolean; pull: boolean }
}

/**
 * GET /api/github/repos
 * Lists repositories accessible to the authenticated user.
 */
export async function GET(request: Request) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const visibility = searchParams.get("visibility") || undefined
    const sort = searchParams.get("sort") || "updated"

    const params: Record<string, string | number | boolean> = {
      sort,
      direction: "desc",
    }
    if (visibility) params.visibility = visibility

    const repos = await githubPaginateAll<GitHubRepo>(token, "/user/repos", {
      params,
      perPage: 100,
      maxPages: 5,
    })

    return NextResponse.json({
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        fork: r.fork,
        htmlUrl: r.html_url,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        openIssues: r.open_issues_count,
        defaultBranch: r.default_branch,
        archived: r.archived,
        visibility: r.visibility,
        pushedAt: r.pushed_at,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
        owner: r.owner.login,
        permissions: r.permissions ?? null,
      })),
      totalCount: repos.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
