import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabMemberResponse = {
  id: number
  username: string
  name: string
  state: string
  avatar_url: string | null
  web_url: string
  access_level: number
  expires_at: string | null
}

/**
 * GET /api/gitlab/groups/[id]/members
 * Returns all members (including inherited) for a given group.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params

  try {
    const raw = await gitlabPaginateAll<GitLabMemberResponse>(
      token,
      `/groups/${encodeURIComponent(id)}/members/all`,
      { perPage: 100, maxPages: 5 }
    )

    const members = raw.map((m) => ({
      id: m.id,
      username: m.username,
      name: m.name,
      state: m.state,
      accessLevel: m.access_level,
      expiresAt: m.expires_at,
    }))

    return NextResponse.json({ members })
  } catch (error) {
    const err = error as { status?: number }
    if (err.status === 403 || err.status === 404) {
      return NextResponse.json({ members: [] })
    }
    return serverError(error, "gitlab")
  }
}
