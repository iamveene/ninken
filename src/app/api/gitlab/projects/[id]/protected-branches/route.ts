import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabProtectedBranchResponse = {
  id: number
  name: string
  push_access_levels: Array<{ access_level: number; access_level_description: string }>
  merge_access_levels: Array<{ access_level: number; access_level_description: string }>
  allow_force_push: boolean
  code_owner_approval_required: boolean
}

/**
 * GET /api/gitlab/projects/[id]/protected-branches
 * Returns the protected branches for a given project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params

  try {
    const raw = await gitlabPaginateAll<GitLabProtectedBranchResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/protected_branches`,
      { perPage: 100, maxPages: 3 }
    )

    const branches = raw.map((b) => ({
      id: b.id,
      name: b.name,
      pushAccessLevels: b.push_access_levels.map((l) => ({
        accessLevel: l.access_level,
        accessLevelDescription: l.access_level_description,
      })),
      mergeAccessLevels: b.merge_access_levels.map((l) => ({
        accessLevel: l.access_level,
        accessLevelDescription: l.access_level_description,
      })),
      allowForcePush: b.allow_force_push,
      codeOwnerApprovalRequired: b.code_owner_approval_required,
    }))

    return NextResponse.json({ branches })
  } catch (error) {
    // 403/404 are expected for projects without permission
    const err = error as { status?: number }
    if (err.status === 403 || err.status === 404) {
      return NextResponse.json({ branches: [] })
    }
    return serverError(error, "gitlab")
  }
}
