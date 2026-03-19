import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Check for multi-profile tokens cookie
  const tokenCookie = request.cookies.get(AUTH_COOKIE_NAME)
  let hasToken = false
  if (tokenCookie?.value) {
    try {
      const parsed = JSON.parse(tokenCookie.value)
      hasToken = Array.isArray(parsed) ? parsed.length > 0 : !!parsed
    } catch {
      hasToken = false
    }
  }

  // API routes (except /api/auth) require auth
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    if (!hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Protected pages: redirect to landing if no auth
  if (pathname.startsWith("/gmail") || pathname.startsWith("/drive") || pathname.startsWith("/buckets")) {
    if (!hasToken) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  // Landing page: redirect to /gmail if already authenticated
  if (pathname === "/") {
    if (hasToken) {
      return NextResponse.redirect(new URL("/gmail", request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
