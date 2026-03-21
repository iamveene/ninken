import { createDriveServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

export const dynamic = "force-dynamic"

function sanitizeFileName(name: string): string {
  // Remove characters that could cause header injection or path traversal
  return name.replace(/["\r\n\\\/]/g, "_")
}

const GOOGLE_DOCS_EXPORT_MIMES: Record<string, Record<string, string>> = {
  "application/vnd.google-apps.document": {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    html: "text/html",
  },
  "application/vnd.google-apps.spreadsheet": {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
  },
  "application/vnd.google-apps.presentation": {
    pdf: "application/pdf",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  "application/vnd.google-apps.drawing": {
    pdf: "application/pdf",
    png: "image/png",
    svg: "image/svg+xml",
  },
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/drive/files/[id]/download">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || undefined

    const drive = createDriveServiceFromToken(accessToken)

    // Get file metadata first
    const meta = await drive.files.get({
      fileId: id,
      fields: "id, name, mimeType, size",
    })

    const mimeType = meta.data.mimeType || ""
    const fileName = meta.data.name || "download"

    // Check if it's a Google Docs type that needs export
    const exportMimes = GOOGLE_DOCS_EXPORT_MIMES[mimeType]
    if (exportMimes) {
      const exportFormat = format || "pdf"
      const exportMimeType = exportMimes[exportFormat]
      if (!exportMimeType) {
        return new Response(
          JSON.stringify({
            error: `Unsupported export format: ${exportFormat}. Supported: ${Object.keys(exportMimes).join(", ")}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const res = await drive.files.export(
        { fileId: id, mimeType: exportMimeType },
        { responseType: "arraybuffer" }
      )

      const buffer = Buffer.from(res.data as ArrayBuffer)
      const safeName = sanitizeFileName(fileName)
      return new Response(buffer, {
        headers: {
          "Content-Type": exportMimeType,
          "Content-Disposition": `attachment; filename="${safeName}.${exportFormat}"`,
          "Content-Length": buffer.length.toString(),
        },
      })
    }

    // Regular file download
    const res = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "arraybuffer" }
    )

    const buffer = Buffer.from(res.data as ArrayBuffer)
    const safeName = sanitizeFileName(fileName)
    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
