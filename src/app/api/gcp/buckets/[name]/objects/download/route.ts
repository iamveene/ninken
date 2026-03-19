import { createStorageService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, badRequest } from "../../../../../_helpers"

function sanitizeFileName(name: string): string {
  return name.replace(/["\r\n\\\/]/g, "_")
}

function htmlError(title: string, message: string, status: number) {
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#333}
.card{text-align:center;padding:2rem;border:1px solid #e5e5e5;border-radius:8px;background:#fff;max-width:400px}
h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#666;margin:0;font-size:.875rem}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html" },
  })
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/gcp/buckets/[name]/objects/download">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { name } = await ctx.params
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")
    if (!path) return badRequest("Missing required query parameter: path")

    const storage = createStorageService(token)
    const res = await storage.objects.get(
      { bucket: name, object: path, alt: "media" },
      { responseType: "arraybuffer" }
    )

    const buffer = Buffer.from(res.data as ArrayBuffer)
    const fileName = path.split("/").pop() || "download"
    const safeName = sanitizeFileName(fileName)

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const apiError = error as { code: number; message?: string }
      if (apiError.code === 403) {
        return htmlError("Access Denied", "You don't have permission to download this file.", 403)
      }
      if (apiError.code === 404) {
        return htmlError("Not Found", "The requested file was not found.", 404)
      }
    }
    return htmlError("Download Failed", "An error occurred while downloading the file.", 500)
  }
}
