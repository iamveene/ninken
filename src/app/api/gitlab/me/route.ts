import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabJson, getRateLimit, detectScopes } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

type GitLabUserResponse = {
  id: number
  username: string
  name: string
  email: string | null
  avatar_url: string
  web_url: string
  state: string
  is_admin: boolean
  bio: string | null
  public_email: string | null
  created_at: string
  two_factor_enabled: boolean
}

/**
 * GET /api/gitlab/me
 * Returns the authenticated GitLab user profile, scopes, and rate limit info.
 */
export async function GET() {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  try {
    const { data: user } = await gitlabJson<GitLabUserResponse>(token, "/user")
    const { scopes, tokenName, expiresAt } = await detectScopes(token)
    const rateLimit = getRateLimit(token)

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      emailAddress: user.email || user.public_email,
      avatarUrl: user.avatar_url,
      webUrl: user.web_url,
      state: user.state,
      isAdmin: user.is_admin,
      bio: user.bio,
      publicEmail: user.public_email,
      createdAt: user.created_at,
      twoFactorEnabled: user.two_factor_enabled,
      scopes,
      tokenName,
      tokenExpiresAt: expiresAt,
      rateLimit: {
        remaining: rateLimit.remaining,
        reset: rateLimit.reset,
      },
    })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
