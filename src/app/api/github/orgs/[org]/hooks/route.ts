import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubHook = {
  id: number
  name: string
  active: boolean
  events: string[]
  config: {
    url?: string
    content_type?: string
    insecure_ssl?: string
  }
  created_at: string
  updated_at: string
}

/**
 * GET /api/github/orgs/[org]/hooks
 * Lists webhooks for an organization.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ org: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { org } = await params

    const hooks = await githubPaginateAll<GitHubHook>(
      token,
      `/orgs/${org}/hooks`,
      { perPage: 100, maxPages: 3 }
    )

    return NextResponse.json({
      hooks: hooks.map((h) => ({
        id: h.id,
        name: h.name,
        active: h.active,
        events: h.events,
        url: h.config.url ?? null,
        contentType: h.config.content_type ?? null,
        insecureSsl: h.config.insecure_ssl === "1",
        createdAt: h.created_at,
        updatedAt: h.updated_at,
      })),
      totalCount: hooks.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
