import { NextResponse } from "next/server"
import { getGitLabAccessToken, unauthorized, serverError } from "@/app/api/_helpers"
import { gitlabJson, gitlabPaginateAll } from "@/lib/gitlab"

export const dynamic = "force-dynamic"

// ── GitLab API response types ────────────────────────────────────────

type GitLabUserResponse = {
  id: number
  username: string
  is_admin: boolean
  two_factor_enabled: boolean
}

type GitLabProjectResponse = {
  id: number
  name: string
  path_with_namespace: string
  visibility: string
  archived: boolean
  default_branch: string | null
}

type GitLabProtectedBranchResponse = {
  name: string
  push_access_levels: Array<{ access_level: number }>
  merge_access_levels: Array<{ access_level: number }>
}

type GitLabVariableResponse = {
  key: string
  masked: boolean
  protected: boolean
  variable_type: string
}

type GitLabHookResponse = {
  id: number
  url: string
  enable_ssl_verification: boolean
}

type GitLabDeployTokenResponse = {
  id: number
  name: string
  scopes: string[]
  expires_at: string | null
  active: boolean
}

type GitLabMemberResponse = {
  id: number
  username: string
  access_level: number
  state: string
}

type GitLabGroupResponse = {
  id: number
  name: string
  full_path: string
}

type GitLabRunnerResponse = {
  id: number
  description: string
  runner_type: string
  active: boolean
  is_shared: boolean
  tag_list: string[]
}

// ── Concurrency helper ──────────────────────────────────────────────

async function batchConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn))
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      }
    }
  }
  return results
}

// ── Safe fetch helper (returns empty array on 403/404) ──────────────

async function safePaginateAll<T>(
  token: string,
  path: string,
): Promise<T[]> {
  try {
    return await gitlabPaginateAll<T>(token, path, {
      perPage: 100,
      maxPages: 3,
    })
  } catch (error) {
    const err = error as { status?: number }
    if (err.status === 403 || err.status === 404) {
      return []
    }
    throw error
  }
}

/**
 * GET /api/gitlab/audit/risk-data
 * Aggregates security-relevant data across all accessible projects, groups, and runners.
 * Used by the GitLab risk scoring and attack path features.
 */
export async function GET() {
  const token = await getGitLabAccessToken()
  if (!token) return unauthorized()

  try {
    // 1. Get user info
    const { data: rawUser } = await gitlabJson<GitLabUserResponse>(token, "/user")

    // 2. Get all projects (cap at 50 for performance)
    const rawProjects = await gitlabPaginateAll<GitLabProjectResponse>(
      token,
      "/projects",
      {
        params: { membership: "true", order_by: "last_activity_at", sort: "desc" },
        perPage: 50,
        maxPages: 1,
      }
    )

    // 3. For each project, fetch security-relevant data (5 concurrent)
    const projectsWithDetails = await batchConcurrent(
      rawProjects,
      5,
      async (project) => {
        const pid = encodeURIComponent(String(project.id))

        const [protectedBranches, variables, hooks, deployTokens, members] =
          await Promise.all([
            safePaginateAll<GitLabProtectedBranchResponse>(
              token,
              `/projects/${pid}/protected_branches`
            ),
            safePaginateAll<GitLabVariableResponse>(
              token,
              `/projects/${pid}/variables`
            ),
            safePaginateAll<GitLabHookResponse>(
              token,
              `/projects/${pid}/hooks`
            ),
            safePaginateAll<GitLabDeployTokenResponse>(
              token,
              `/projects/${pid}/deploy_tokens`
            ),
            safePaginateAll<GitLabMemberResponse>(
              token,
              `/projects/${pid}/members/all`
            ),
          ])

        return {
          id: project.id,
          name: project.name,
          pathWithNamespace: project.path_with_namespace,
          visibility: project.visibility,
          archived: project.archived,
          defaultBranch: project.default_branch,
          protectedBranches: protectedBranches.map((b) => ({
            name: b.name,
            pushAccessLevels: b.push_access_levels.map((l) => ({
              accessLevel: l.access_level,
            })),
            mergeAccessLevels: b.merge_access_levels.map((l) => ({
              accessLevel: l.access_level,
            })),
          })),
          variables: variables.map((v) => ({
            key: v.key,
            masked: v.masked,
            protected: v.protected,
            variableType: v.variable_type,
          })),
          hooks: hooks.map((h) => ({
            id: h.id,
            url: h.url,
            enableSslVerification: h.enable_ssl_verification,
          })),
          deployTokens: deployTokens.map((t) => ({
            id: t.id,
            name: t.name,
            scopes: t.scopes,
            expiresAt: t.expires_at,
            active: t.active,
          })),
          members: members.map((m) => ({
            id: m.id,
            username: m.username,
            accessLevel: m.access_level,
            state: m.state,
          })),
        }
      }
    )

    // 4. Get all groups
    const rawGroups = await gitlabPaginateAll<GitLabGroupResponse>(
      token,
      "/groups",
      {
        params: { min_access_level: "10" },
        perPage: 100,
        maxPages: 2,
      }
    )

    // 5. For each group, fetch members (5 concurrent)
    const groupMembers = await batchConcurrent(rawGroups, 5, async (group) => {
      const gid = encodeURIComponent(String(group.id))
      const members = await safePaginateAll<GitLabMemberResponse>(
        token,
        `/groups/${gid}/members/all`
      )

      return {
        groupId: group.id,
        groupName: group.name,
        members: members.map((m) => ({
          id: m.id,
          username: m.username,
          accessLevel: m.access_level,
        })),
      }
    })

    // 6. Get runners
    let runners: Array<{
      id: number
      description: string
      runnerType: string
      active: boolean
      isShared: boolean
      tagList: string[]
    }> = []

    try {
      const rawRunners = await gitlabPaginateAll<GitLabRunnerResponse>(
        token,
        "/runners",
        { perPage: 100, maxPages: 3 }
      )
      runners = rawRunners.map((r) => ({
        id: r.id,
        description: r.description,
        runnerType: r.runner_type,
        active: r.active,
        isShared: r.is_shared,
        tagList: r.tag_list ?? [],
      }))
    } catch {
      // Runners API may not be accessible
    }

    return NextResponse.json({
      user: {
        username: rawUser.username,
        isAdmin: rawUser.is_admin,
        twoFactorEnabled: rawUser.two_factor_enabled,
      },
      projects: projectsWithDetails,
      groupMembers,
      runners,
    })
  } catch (error) {
    return serverError(error, "gitlab")
  }
}
