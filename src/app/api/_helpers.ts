import { cookies } from "next/headers"
import { getTokenFromCookies, type TokenData } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function getTokenFromRequest(): Promise<TokenData | null> {
  const cookieStore = await cookies()
  return getTokenFromCookies(cookieStore)
}

export function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function serverError(error: unknown) {
  // Detect Google API errors with specific status codes
  if (error && typeof error === "object" && "code" in error) {
    const apiError = error as { code: number; message?: string }
    const status = apiError.code
    if (status >= 400 && status < 600) {
      return NextResponse.json(
        { error: apiError.message || "Request failed" },
        { status }
      )
    }
  }
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ error: message }, { status: 500 })
}
