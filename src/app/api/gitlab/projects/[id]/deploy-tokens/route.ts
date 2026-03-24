import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabDeployTokenResponse = {
  id: number
  name: string
  username: string
  expires_at: string | null
  scopes: string[]
  active: boolean
  revoked: boolean
  created_at: string
}

/**
 * GET /api/gitlab/projects/[id]/deploy-tokens
 * Returns deploy tokens for a given project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params

  try {
    const raw = await gitlabPaginateAll<GitLabDeployTokenResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/deploy_tokens`,
      { perPage: 100, maxPages: 3 }
    )

    const tokens = raw.map((t) => ({
      id: t.id,
      name: t.name,
      username: t.username,
      expiresAt: t.expires_at,
      scopes: t.scopes,
      active: t.active,
      revoked: t.revoked,
      createdAt: t.created_at,
    }))

    return NextResponse.json({ tokens })
  } catch (error) {
    const err = error as { status?: number }
    if (err.status === 403 || err.status === 404) {
      return NextResponse.json({ tokens: [] })
    }
    return serverError(error, "gitlab")
  }
}
