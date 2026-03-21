import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubJson } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubInstallation = {
  id: number
  app_id: number
  app_slug: string
  target_type: string
  account: { login: string; avatar_url: string }
  permissions: Record<string, string>
  events: string[]
  created_at: string
  updated_at: string
  repository_selection: string
}

type InstallationsResponse = {
  total_count: number
  installations: GitHubInstallation[]
}

/**
 * GET /api/github/orgs/[org]/installations
 * Lists GitHub App installations for an organization.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ org: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { org } = await params

    const { data } = await githubJson<InstallationsResponse>(
      token,
      `/orgs/${org}/installations`
    )

    return NextResponse.json({
      installations: data.installations.map((i) => ({
        id: i.id,
        appId: i.app_id,
        appSlug: i.app_slug,
        targetType: i.target_type,
        account: i.account.login,
        permissions: i.permissions,
        events: i.events,
        repositorySelection: i.repository_selection,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
      totalCount: data.total_count,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
