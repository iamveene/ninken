import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabSnippetResponse = {
  id: number
  title: string
  description: string | null
  visibility: string
  web_url: string
  file_name: string | null
  created_at: string
  updated_at: string
  author: { username: string }
}

/**
 * GET /api/gitlab/snippets
 * Returns the authenticated user's snippets.
 */
export async function GET() {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  try {
    const raw = await gitlabPaginateAll<GitLabSnippetResponse>(token, "/snippets", {
      perPage: 100,
      maxPages: 5,
    })

    const snippets = raw.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      visibility: s.visibility,
      webUrl: s.web_url,
      fileName: s.file_name,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      author: s.author?.username ?? "",
    }))

    return NextResponse.json({ snippets, totalCount: snippets.length })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
