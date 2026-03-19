import { NextResponse } from "next/server"
import {
  getGitLabAccessToken,
  unauthorized,
  badRequest,
  serverError,
} from "@/app/api/_helpers"
import { gitlabJson } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabFileResponse = {
  file_name: string
  file_path: string
  size: number
  encoding: string
  content: string
  content_sha256: string
  ref: string
  blob_id: string
  last_commit_id: string
}

const MAX_CONTENT_SIZE = 1024 * 1024 // 1 MB

/**
 * GET /api/gitlab/projects/[id]/file
 * Returns the content of a single file in a project repository.
 * Query params: path (required, URL-encoded file path), ref (default "main")
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  const { id } = await params
  const url = new URL(request.url)
  const filePath = url.searchParams.get("path")
  const ref = url.searchParams.get("ref") || "main"

  if (!filePath) {
    return badRequest("Missing required query parameter: path")
  }

  try {
    const encodedFilePath = encodeURIComponent(filePath)
    const { data } = await gitlabJson<GitLabFileResponse>(
      token,
      `/projects/${encodeURIComponent(id)}/repository/files/${encodedFilePath}`,
      { params: { ref } }
    )

    const truncated = data.size > MAX_CONTENT_SIZE

    return NextResponse.json({
      fileName: data.file_name,
      filePath: data.file_path,
      size: data.size,
      encoding: data.encoding,
      content: truncated ? null : data.content,
      contentSha256: data.content_sha256,
      ref: data.ref,
      blobId: data.blob_id,
      lastCommitId: data.last_commit_id,
      truncated,
    })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
