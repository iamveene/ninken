import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import https from "node:https"

export const dynamic = "force-dynamic"

/**
 * GET /api/gitlab/projects/[id]/archive
 * Downloads the repository archive as tar.gz.
 * Uses node:https instead of fetch because GitLab returns 406 with
 * Node's undici fetch for binary archive endpoints.
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
    const data = await new Promise<Buffer>((resolve, reject) => {
      const options = {
        hostname: "gitlab.com",
        path: `/api/v4/projects/${encodeURIComponent(id)}/repository/archive.tar.gz?sha=${encodeURIComponent(ref)}`,
        headers: { "PRIVATE-TOKEN": token },
      }

      https.get(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let body = ""
          res.on("data", (chunk: Buffer) => { body += chunk.toString() })
          res.on("end", () => reject(new Error(`GitLab archive: ${res.statusCode} ${body}`)))
          return
        }

        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => resolve(Buffer.concat(chunks)))
        res.on("error", reject)
      }).on("error", reject)
    })

    return new Response(new Uint8Array(data), {
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
