import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import https from "node:https"

export const dynamic = "force-dynamic"

/**
 * GET /api/github/repos/[owner]/[repo]/archive
 * Downloads the repository archive as zip.
 * Uses node:https to follow GitHub's redirect to the actual zip payload.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  const { owner, repo } = await params
  const url = new URL(request.url)
  const ref = url.searchParams.get("ref") || "main"

  try {
    const data = await new Promise<Buffer>((resolve, reject) => {
      const doRequest = (reqUrl: string) => {
        const parsed = new URL(reqUrl)
        const options: https.RequestOptions = {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Ninken",
          },
        }

        https.get(options, (res) => {
          // Follow redirects (GitHub returns 302 to a pre-signed URL)
          if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            // The redirect target is a pre-signed URL — no auth header needed
            const redirectUrl = res.headers.location
            const redirectParsed = new URL(redirectUrl)
            const redirectOptions: https.RequestOptions = {
              hostname: redirectParsed.hostname,
              path: redirectParsed.pathname + redirectParsed.search,
              headers: { "User-Agent": "Ninken" },
            }
            https.get(redirectOptions, (redirectRes) => {
              if (redirectRes.statusCode && redirectRes.statusCode >= 400) {
                let body = ""
                redirectRes.on("data", (chunk: Buffer) => { body += chunk.toString() })
                redirectRes.on("end", () => reject(new Error(`GitHub archive redirect: ${redirectRes.statusCode} ${body}`)))
                return
              }
              const chunks: Buffer[] = []
              redirectRes.on("data", (chunk: Buffer) => chunks.push(chunk))
              redirectRes.on("end", () => resolve(Buffer.concat(chunks)))
              redirectRes.on("error", reject)
            }).on("error", reject)
            return
          }

          if (res.statusCode && res.statusCode >= 400) {
            let body = ""
            res.on("data", (chunk: Buffer) => { body += chunk.toString() })
            res.on("end", () => reject(new Error(`GitHub archive: ${res.statusCode} ${body}`)))
            return
          }

          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => chunks.push(chunk))
          res.on("end", () => resolve(Buffer.concat(chunks)))
          res.on("error", reject)
        }).on("error", reject)
      }

      doRequest(`https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(ref)}`)
    })

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${owner}_${repo}.zip"`,
        "Content-Length": String(data.byteLength),
      },
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
