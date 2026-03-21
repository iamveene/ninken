import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabProjectResponse = {
  id: number
  name: string
  name_with_namespace: string
  path_with_namespace: string
  description: string | null
  visibility: string
  web_url: string
  default_branch: string | null
  archived: boolean
  forked_from_project?: unknown
  star_count: number
  forks_count: number
  open_issues_count: number
  last_activity_at: string
  created_at: string
  namespace: { name: string }
  avatar_url: string | null
}

/**
 * GET /api/gitlab/projects
 * Returns the authenticated user's accessible projects.
 */
export async function GET() {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  try {
    const raw = await gitlabPaginateAll<GitLabProjectResponse>(token, "/projects", {
      params: { membership: true, order_by: "last_activity_at", sort: "desc" },
      perPage: 100,
      maxPages: 5,
    })

    const projects = raw.map((p) => ({
      id: p.id,
      name: p.name,
      nameWithNamespace: p.name_with_namespace,
      pathWithNamespace: p.path_with_namespace,
      description: p.description,
      visibility: p.visibility,
      webUrl: p.web_url,
      defaultBranch: p.default_branch,
      archived: p.archived,
      forked: !!p.forked_from_project,
      stars: p.star_count,
      forks: p.forks_count,
      openIssuesCount: p.open_issues_count,
      lastActivityAt: p.last_activity_at,
      createdAt: p.created_at,
      namespace: p.namespace?.name ?? "",
      avatarUrl: p.avatar_url,
    }))

    return NextResponse.json({ projects, totalCount: projects.length })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
