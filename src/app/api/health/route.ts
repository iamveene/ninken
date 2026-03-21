export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({
    status: "ok",
    version: process.env.npm_package_version ?? "unknown",
    uptime: Math.floor(process.uptime()),
  })
}
