import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabFetch } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

/**
 * GET /api/gitlab/projects/[id]/archive
 * Downloads the repository archive as tar.gz.
 * Query params: ref (default branch or "main")
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params
  const url = new URL(request.url)
  const ref = url.searchParams.get("ref") || "main"

  try {
    const res = await gitlabFetch(
      token,
      `/projects/${encodeURIComponent(id)}/repository/archive.tar.gz`,
      { params: { sha: ref } }
    )

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return new Response(body || "Archive download failed", { status: res.status })
    }

    const data = await res.arrayBuffer()
    return new Response(data, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="repo-${id}-${ref}.tar.gz"`,
        "Content-Length": String(data.byteLength),
      },
    })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
