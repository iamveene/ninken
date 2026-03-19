import { cookies } from "next/headers"
import { getTokenFromCookies, type TokenData } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function getTokenFromRequest(): Promise<TokenData | null> {
  const cookieStore = await cookies()
  return getTokenFromCookies(cookieStore)
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

  // Detect Google API errors that use the { errors: [...] } shape without a numeric code
  if (error && typeof error === "object") {
    const err = error as { errors?: { message?: string; reason?: string }[]; message?: string }
    if (Array.isArray(err.errors) && err.errors.length > 0) {
      const msg = err.errors[0].message || err.message || "Request failed"
      const isInvalid = msg.toLowerCase().includes("invalid") || err.errors[0].reason === "notFound"
      return NextResponse.json(
        { error: msg },
        { status: isInvalid ? 400 : 500 }
      )
    }
    // Catch errors whose message indicates an invalid/bad request
    if (err.message && /\binvalid\b/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }

  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ error: message }, { status: 500 })
}
