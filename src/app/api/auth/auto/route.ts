import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { resolve } from "path"
import {
  AUTH_COOKIE_NAME,
  ACTIVE_PROFILE_COOKIE,
  validateTokenData,
  type ProfileData,
} from "@/lib/auth"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

/**
 * GET /api/auth/auto
 *
 * Auto-loads token from TOKEN_FILE env var (or ../../../token.json relative to project root).
 * Sets the auth cookie so the app is immediately authenticated.
 * Only works in development.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const tokenPath = process.env.TOKEN_FILE || resolve(process.cwd(), ".secrets/token.json")

  try {
    const raw = await readFile(tokenPath, "utf-8")
    const data = JSON.parse(raw)

    const result = validateTokenData(data)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const profile: ProfileData = {
      ...result.token,
      email: typeof data.email === "string" ? data.email : undefined,
    }

    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, JSON.stringify([profile]), COOKIE_OPTS)
    cookieStore.set(ACTIVE_PROFILE_COOKIE, "0", COOKIE_OPTS)

    return NextResponse.json({
      authenticated: true,
      tokenFile: tokenPath,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read token file"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
