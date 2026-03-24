import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabTreeItemResponse = {
  id: string
  name: string
  type: "tree" | "blob"
  path: string
  mode: string
}

/**
 * GET /api/gitlab/projects/[id]/tree
 * Returns the repository tree for a given project and path.
 * Query params: path (default ""), ref (default "main")
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params
  const url = new URL(request.url)
  const path = url.searchParams.get("path") || ""
  const ref = url.searchParams.get("ref") || "main"

  try {
    const raw = await gitlabPaginateAll<GitLabTreeItemResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/repository/tree`,
      {
        params: {
          path,
          ref,
          per_page: 100,
        },
        perPage: 100,
        maxPages: 10,
      }
    )

    // Sort: folders first, then files, alphabetical within each group
    const sorted = raw.sort((a, b) => {
      if (a.type === "tree" && b.type !== "tree") return -1
      if (a.type !== "tree" && b.type === "tree") return 1
      return a.name.localeCompare(b.name)
    })

    const items = sorted.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      path: item.path,
      mode: item.mode,
    }))

    return NextResponse.json({ items, totalCount: items.length })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
