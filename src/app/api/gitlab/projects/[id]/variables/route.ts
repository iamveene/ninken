import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabVariableResponse = {
  key: string
  value: string
  variable_type: string
  protected: boolean
  masked: boolean
  environment_scope: string
}

/**
 * GET /api/gitlab/projects/[id]/variables
 * Returns CI/CD variables for a given project (values are redacted).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params

  try {
    const raw = await gitlabPaginateAll<GitLabVariableResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/variables`,
      { perPage: 100, maxPages: 3 }
    )

    const variables = raw.map((v) => ({
      key: v.key,
      variableType: v.variable_type,
      protected: v.protected,
      masked: v.masked,
      environmentScope: v.environment_scope,
    }))

    return NextResponse.json({ variables })
  } catch (error) {
    const err = error as { status?: number }
    if (err.status === 403 || err.status === 404) {
      return NextResponse.json({ variables: [] })
    }
    return serverError(error, "gitlab")
  }
}
