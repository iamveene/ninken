export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join, relative } from "path"
import { execSync } from "child_process"

/**
 * Recursively collect files from a directory, excluding unwanted patterns.
 */
function collectFiles(
  dir: string,
  base: string,
  exclude: RegExp
): { path: string; relativePath: string }[] {
  const results: { path: string; relativePath: string }[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    const rel = relative(base, fullPath)
    if (exclude.test(rel) || exclude.test(entry.name)) continue
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, base, exclude))
    } else {
      results.push({ path: fullPath, relativePath: rel })
    }
  }
  return results
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  const ninloaderDir = join(process.cwd(), "ninloader")

  if (!existsSync(ninloaderDir)) {
    return Response.json(
      { error: "NinLoader directory not found" },
      { status: 404 }
    )
  }

  if (type === "python") {
    // Build a tar.gz of the ninloader/ directory
    // Include: ninloader.py, pyproject.toml, ninloader/ subpackage
    // Exclude: __pycache__, *.pyc, .egg-info, tokens/, NinLoader.ps1
    const exclude =
      /__pycache__|\.pyc$|\.egg-info|\/tokens\/|\/tokens$|\.ps1$/
    const files = collectFiles(ninloaderDir, ninloaderDir, exclude)

    if (files.length === 0) {
      return Response.json(
        { error: "No Python files found" },
        { status: 404 }
      )
    }

    // Use tar command to create the archive — reliable and handles directory structure
    const excludeArgs = [
      "--exclude=__pycache__",
      "--exclude=*.pyc",
      "--exclude=*.egg-info",
      "--exclude=tokens",
      "--exclude=NinLoader.ps1",
    ].join(" ")

    try {
      const tarBuffer = execSync(
        `tar czf - ${excludeArgs} -C "${join(ninloaderDir, "..")}" ninloader`,
        { maxBuffer: 50 * 1024 * 1024 }
      )

      return new Response(tarBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": 'attachment; filename="ninloader.tar.gz"',
          "Content-Length": String(tarBuffer.length),
        },
      })
    } catch {
      return Response.json(
        { error: "Failed to create archive" },
        { status: 500 }
      )
    }
  }

  if (type === "powershell") {
    const psPath = join(ninloaderDir, "NinLoader.ps1")
    if (!existsSync(psPath)) {
      return Response.json(
        { error: "NinLoader.ps1 not found" },
        { status: 404 }
      )
    }

    try {
      const content = readFileSync(psPath)
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="NinLoader.ps1"',
          "Content-Length": String(content.length),
        },
      })
    } catch {
      return Response.json(
        { error: "Failed to read NinLoader.ps1" },
        { status: 500 }
      )
    }
  }

  if (type === "oneliner") {
    const origin =
      request.headers.get("x-forwarded-proto") && request.headers.get("host")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
        : request.headers.get("host")
          ? `http://${request.headers.get("host")}`
          : new URL(request.url).origin

    return Response.json({
      python: `curl -sL ${origin}/api/ninloader/download?type=python | tar xz && cd ninloader && python3 ninloader.py discover`,
      powershell: `iwr ${origin}/api/ninloader/download?type=powershell -OutFile NinLoader.ps1; .\\NinLoader.ps1 -Discover`,
    })
  }

  return Response.json(
    {
      error: "Invalid type parameter. Use: python, powershell, or oneliner",
      valid_types: ["python", "powershell", "oneliner"],
    },
    { status: 400 }
  )
}
