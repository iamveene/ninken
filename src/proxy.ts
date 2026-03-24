import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth"

// Provider → default route mapping (must stay in sync with ServiceProvider.defaultRoute)
const PROVIDER_DEFAULT_ROUTES: Record<string, string> = {
  google: "/gmail",
  microsoft: "/m365-dashboard",
  github: "/github-dashboard",
  gitlab: "/gitlab-dashboard",
  slack: "/slack-dashboard",
  aws: "/aws-dashboard",
  gcp: "/gcp-dashboard",
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for new cookie format first, fallback to legacy
  let hasToken = false
  let provider: string | null = null

  const newTokenCookie = request.cookies.get("ninken_token")
  if (newTokenCookie?.value) {
    try {
      const parsed = JSON.parse(newTokenCookie.value)
      hasToken = !!parsed?.provider && !!parsed?.credential
      if (hasToken) provider = parsed.provider
    } catch {
      hasToken = false
    }
  }

  // Fallback: legacy cookie
  if (!hasToken) {
    const legacyCookie = request.cookies.get(AUTH_COOKIE_NAME)
    if (legacyCookie?.value) {
      try {
        const parsed = JSON.parse(legacyCookie.value)
        hasToken = Array.isArray(parsed) ? parsed.length > 0 : !!parsed
        if (hasToken) provider = "google" // Legacy is always Google
      } catch {
        hasToken = false
      }
    }
  }

  // Also check the provider cookie
  if (!provider) {
    const providerCookie = request.cookies.get("ninken_provider")
    if (providerCookie?.value) provider = providerCookie.value
  }

  // API routes (except /api/auth) require auth
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth") && !pathname.startsWith("/api/health") && !pathname.startsWith("/api/slack/validate-token") && !pathname.startsWith("/api/ninloader/download") && !pathname.startsWith("/api/settings") && !pathname.startsWith("/api/mcp") && !pathname.startsWith("/api/vault") && !pathname.startsWith("/api/events")) {
    if (!hasToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Protected pages: redirect to landing if no auth
  const protectedPrefixes = [
    // Google
    "/gmail", "/drive", "/buckets", "/calendar", "/directory", "/audit", "/chat", "/dashboard",
    // Microsoft
    "/outlook", "/onedrive", "/teams", "/entra", "/sharepoint", "/m365-dashboard", "/m365-audit", "/m365-secret-search",
    // GitHub
    "/github-dashboard", "/repos", "/orgs", "/actions", "/gists", "/github-audit", "/github-secret-search",
    // GitLab
    "/gitlab-dashboard", "/gitlab-projects", "/gitlab-groups", "/gitlab-pipelines", "/gitlab-snippets", "/gitlab-audit",
    // Slack
    "/channels", "/slack-dashboard", "/slack-files", "/slack-users",
    // AWS
    "/aws-dashboard", "/aws-s3", "/aws-iam", "/aws-lambda", "/aws-ec2", "/aws-cloudtrail", "/aws-secrets", "/aws-audit",
    // GCP
    "/gcp-dashboard", "/gcp-firestore", "/gcp-rtdb", "/gcp-storage", "/gcp-compute", "/gcp-vertexai",
    // Explore
    "/explore",
    // Cross-service (Studio is intentionally NOT here — accessible without auth)
    "/collection", "/alerts", "/opsec",
  ]

  if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
    if (!hasToken) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  // Landing page: always show (no auto-redirect)
  if (pathname === "/") {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
