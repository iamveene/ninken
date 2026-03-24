import { NextResponse } from "next/server"
import { getGitHubAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { githubJson, getRateLimit, detectScopes } from "@/lib/github"

export const dynamic = "force-dynamic"

type GitHubUser = {
  login: string
  id: number
  name: string | null
  email: string | null
  avatar_url: string
  html_url: string
  type: string
  site_admin: boolean
  company: string | null
  blog: string | null
  location: string | null
  bio: string | null
  public_repos: number
  public_gists: number
  followers: number
  following: number
  created_at: string
  updated_at: string
  two_factor_authentication?: boolean
}

/**
 * GET /api/github/me
 * Returns the authenticated GitHub user profile, scopes, and rate limit info.
 */
export async function GET() {
  const token = await getGitHubAccessToken()
  if (!token) return unauthorized()

  try {
    const { data: user } = await githubJson<GitHubUser>(token, "/user")
    const { scopes, tokenType } = await detectScopes(token)
    const rateLimit = getRateLimit(token)

    return NextResponse.json({
      login: user.login,
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      type: user.type,
      siteAdmin: user.site_admin,
      company: user.company,
      bio: user.bio,
      publicRepos: user.public_repos,
      publicGists: user.public_gists,
      followers: user.followers,
      following: user.following,
      createdAt: user.created_at,
      twoFactorAuthentication: user.two_factor_authentication ?? null,
      scopes,
      tokenType,
      rateLimit: {
        remaining: rateLimit.remaining,
        reset: rateLimit.reset,
      },
    })
  } catch (error) {
    return serverError(error, "github")
  }
}
