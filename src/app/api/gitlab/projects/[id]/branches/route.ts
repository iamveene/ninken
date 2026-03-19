import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabBranchResponse = {
  name: string
  default: boolean
  web_url: string
}

/**
 * GET /api/gitlab/projects/[id]/branches
 * Returns the repository branches for a given project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params

  try {
    const raw = await gitlabPaginateAll<GitLabBranchResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/repository/branches`,
      {
        perPage: 100,
        maxPages: 5,
      }
    )

    const branches = raw.map((b) => ({
      name: b.name,
      default: b.default,
      webUrl: b.web_url,
    }))

    return NextResponse.json({ branches, totalCount: branches.length })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
