import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubPaginateAll } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubGist = {
  id: string
  description: string | null
  public: boolean
  html_url: string
  files: Record<string, { filename: string; language: string | null; size: number }>
  created_at: string
  updated_at: string
  comments: number
  owner: { login: string }
}

/**
 * GET /api/github/gists
 * Lists gists for the authenticated user.
 */
export async function GET() {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const gists = await githubPaginateAll<GitHubGist>(token, "/gists", {
      perPage: 100,
      maxPages: 5,
    })

    return NextResponse.json({
      gists: gists.map((g) => ({
        id: g.id,
        description: g.description,
        public: g.public,
        htmlUrl: g.html_url,
        files: Object.values(g.files).map((f) => ({
          filename: f.filename,
          language: f.language,
          size: f.size,
        })),
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        comments: g.comments,
        owner: g.owner.login,
      })),
      totalCount: gists.length,
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
