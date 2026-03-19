import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabGroupResponse = {
  id: number
  name: string
  full_name: string
  full_path: string
  description: string | null
  visibility: string
  web_url: string
  avatar_url: string | null
  parent_id: number | null
  created_at: string
  statistics?: {
    repository_size?: number
    storage_size?: number
  }
}

/**
 * GET /api/gitlab/groups
 * Returns the authenticated user's accessible groups.
 */
export async function GET() {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  try {
    const raw = await gitlabPaginateAll<GitLabGroupResponse>(token, "/groups", {
      params: { order_by: "name", sort: "asc", min_access_level: 10 },
      perPage: 100,
      maxPages: 5,
    })

    const groups = raw.map((g) => ({
      id: g.id,
      name: g.name,
      fullName: g.full_name,
      fullPath: g.full_path,
      description: g.description,
      visibility: g.visibility,
      webUrl: g.web_url,
      avatarUrl: g.avatar_url,
      parentId: g.parent_id,
      createdAt: g.created_at,
    }))

    return NextResponse.json({ groups, totalCount: groups.length })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
